"use server";

// Server actions — all user-facing writes. Every action runs against the
// RLS-enforced user client, so ownership is enforced by the database even
// if a bug slips in here. The service-role client appears only where the
// brief requires server authority (approval audit, checkout, admin).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE, REFRESH_COOKIE, adminClient, requireAdmin, requireUser, userClient,
} from "@/lib/supabase/server";
import { enqueue, retry } from "@/lib/jobs/queue";
import { createBookCheckout } from "@/lib/stripe";
import { compatibleTemplates } from "@/lib/book/templates";
import { sha256 } from "@/lib/media";

function anonAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function setSessionCookies(accessToken: string, refreshToken: string) {
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  cookies().set(ACCESS_COOKIE, accessToken, { ...opts, maxAge: 60 * 60 });
  cookies().set(REFRESH_COOKIE, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
}

// ----------------------------------------------------------------- auth

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { data, error } = await anonAuthClient().auth.signUp({ email, password });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (data.session) {
    setSessionCookies(data.session.access_token, data.session.refresh_token);
    redirect("/onboarding");
  }
  redirect("/login?message=Check your email to confirm your account");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { data, error } = await anonAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Sign in failed")}`);
  setSessionCookies(data.session.access_token, data.session.refresh_token);
  redirect("/home");
}

export async function signOut() {
  cookies().delete(ACCESS_COOKIE);
  cookies().delete(REFRESH_COOKIE);
  redirect("/");
}

// ------------------------------------------------------------ onboarding

export async function createChild(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const dob = String(formData.get("date_of_birth") ?? "");
  if (!firstName || !dob) redirect("/onboarding?error=Name and birthday are required");

  const { data: family, error: famErr } = await db
    .from("families")
    .insert({ owner_user_id: user.id })
    .select("id")
    .single();
  if (famErr) throw new Error(famErr.message);

  const { data: child, error: childErr } = await db
    .from("children")
    .insert({
      family_id: family.id,
      first_name: firstName,
      date_of_birth: dob,
      pronouns: String(formData.get("pronouns") ?? "") || null,
    })
    .select("id")
    .single();
  if (childErr) throw new Error(childErr.message);
  redirect(`/onboarding/people?child=${child.id}`);
}

export async function addFamilyMembers(formData: FormData) {
  await requireUser();
  const db = userClient();
  const childId = String(formData.get("child_id"));
  const { data: child } = await db.from("children").select("family_id").eq("id", childId).single();
  if (!child) throw new Error("child not found");

  const raw = String(formData.get("members") ?? "");
  // one per line: "Name | relationship | nickname(optional)"
  for (const line of raw.split("\n")) {
    const [name, relationship, nickname] = line.split("|").map((s) => s.trim());
    if (!name || !relationship) continue;
    await db.from("family_members").insert({
      family_id: child.family_id,
      name,
      relationship,
      nickname_used_by_child: nickname || null,
    });
  }
  redirect(`/children/${childId}/upload?welcome=1`);
}

// -------------------------------------------------------------- memories

/** Called after the client has uploaded bytes directly to private storage. */
export async function registerUploadedPhoto(input: {
  childId: string;
  storagePath: string;
  checksum: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  captureTimestamp: string | null;
  memoryDate: string | null;
}) {
  const user = await requireUser();
  const db = userClient();

  // Exact-duplicate detection (§7): same checksum for this child is skipped.
  const { data: dupes } = await db
    .from("media_assets")
    .select("id, memories!inner(child_id)")
    .eq("checksum", input.checksum)
    .eq("memories.child_id", input.childId);
  if (dupes && dupes.length > 0) return { duplicate: true as const };

  const { data: memory, error } = await db
    .from("memories")
    .insert({
      child_id: input.childId,
      created_by: user.id,
      type: "photo",
      memory_date: input.memoryDate,
      metadata: {},
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: assetErr } = await db.from("media_assets").insert({
    memory_id: memory.id,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    width: input.width,
    height: input.height,
    capture_timestamp: input.captureTimestamp,
    checksum: input.checksum,
    processing_status: "pending",
  });
  if (assetErr) throw new Error(assetErr.message);

  // Queue analysis in batches — one job per child per hour window.
  const window = Math.floor(Date.now() / (60 * 60 * 1000));
  await enqueue(adminClient(), "analyse_memories", { child_id: input.childId }, `analyse-${input.childId}-${window}`);
  return { duplicate: false as const, memoryId: memory.id };
}

export async function addTextMemory(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const childId = String(formData.get("child_id"));
  const type = String(formData.get("type")) === "quote" ? "quote" : "text";
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await db.from("memories").insert({
    child_id: childId,
    created_by: user.id,
    type,
    raw_text: text,
    memory_date: String(formData.get("memory_date") ?? "") || null,
  });
  revalidatePath(`/children/${childId}`);
}

export async function addLittleThing(formData: FormData) {
  await requireUser();
  const db = userClient();
  const childId = String(formData.get("child_id"));
  const category = String(formData.get("category") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  if (!category || !value) return;
  await db.from("little_things").insert({ child_id: childId, category, value });
  revalidatePath(`/children/${childId}/little-things`);
}

// -------------------------------------------------------------- clusters

export async function updateCluster(formData: FormData) {
  await requireUser();
  const db = userClient();
  const clusterId = String(formData.get("cluster_id"));
  const action = String(formData.get("action"));
  const childId = String(formData.get("child_id"));

  if (action === "keep") {
    await db.from("memory_clusters").update({ status: "confirmed" }).eq("id", clusterId);
  } else if (action === "remove") {
    await db.from("memory_clusters").update({ status: "rejected" }).eq("id", clusterId);
  } else if (action === "rename") {
    const title = String(formData.get("title") ?? "").trim();
    if (title) await db.from("memory_clusters").update({ title, status: "confirmed" }).eq("id", clusterId);
  } else if (action === "merge") {
    const intoId = String(formData.get("into_cluster_id"));
    const { data: members } = await db.from("cluster_memories").select("memory_id").eq("cluster_id", clusterId);
    for (const m of members ?? []) {
      await db
        .from("cluster_memories")
        .upsert({ cluster_id: intoId, memory_id: m.memory_id }, { onConflict: "cluster_id,memory_id", ignoreDuplicates: true });
    }
    await db.from("memory_clusters").update({ status: "rejected" }).eq("id", clusterId);
  }
  revalidatePath(`/children/${childId}/clusters`);
}

// -------------------------------------------------------------- questions

export async function answerQuestion(formData: FormData) {
  await requireUser();
  const db = userClient();
  const id = String(formData.get("question_id"));
  const childId = String(formData.get("child_id"));
  const action = String(formData.get("action"));
  if (action === "dismiss") {
    await db.from("follow_up_questions").update({ status: "dismissed" }).eq("id", id);
  } else {
    const answer = String(formData.get("answer") ?? "").trim();
    if (answer) {
      await db.from("follow_up_questions").update({ status: "answered", answer }).eq("id", id);
    }
  }
  revalidatePath(`/children/${childId}/questions`);
}

// ------------------------------------------------------------------ book

export async function createBook(formData: FormData) {
  await requireUser();
  const db = userClient();
  const childId = String(formData.get("child_id"));
  const { data: child } = await db.from("children").select("*").eq("id", childId).single();
  if (!child) throw new Error("child not found");

  // "The year you were N": the most recently completed year of life.
  const dob = new Date(child.date_of_birth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const birthdayThisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  if (now < birthdayThisYear) age -= 1;
  const yearNumber = Math.max(1, age);
  const start = new Date(dob);
  start.setFullYear(dob.getFullYear() + yearNumber - 1);
  const end = new Date(dob);
  end.setFullYear(dob.getFullYear() + yearNumber);
  end.setDate(end.getDate() - 1);

  const { data: existing } = await db
    .from("books")
    .select("id")
    .eq("child_id", childId)
    .eq("year_number", yearNumber)
    .maybeSingle();
  if (existing) redirect(`/books/${existing.id}`);

  const { data: book, error } = await db
    .from("books")
    .insert({
      child_id: childId,
      year_number: yearNumber,
      title: `The Year You Were ${yearNumber}`,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      status: "collecting",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await enqueue(adminClient(), "generate_book", { book_id: book.id }, `generate-${book.id}`);
  redirect(`/books/${book.id}`);
}

export async function updateBlock(formData: FormData) {
  await requireUser();
  const db = userClient();
  const blockId = String(formData.get("block_id"));
  const pageId = String(formData.get("page_id"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await db
    .from("book_content_blocks")
    .update({ content, parent_edited: true })
    .eq("id", blockId);
  revalidatePath(`/books/pages/${pageId}`);
}

export async function removeBlock(formData: FormData) {
  await requireUser();
  const db = userClient();
  await db.from("book_content_blocks").delete().eq("id", String(formData.get("block_id")));
  revalidatePath(`/books/pages/${String(formData.get("page_id"))}`);
}

export async function changeTemplate(formData: FormData) {
  await requireUser();
  const db = userClient();
  const pageId = String(formData.get("page_id"));
  const templateId = String(formData.get("template_id"));
  const { data: page } = await db.from("book_pages").select("template_id").eq("id", pageId).single();
  if (!page) return;
  // Constrained editor (§15): only compatible layout swaps are allowed.
  const allowed = compatibleTemplates(page.template_id).some((t) => t.id === templateId);
  if (!allowed) return;
  await db.from("book_pages").update({ template_id: templateId }).eq("id", pageId);
  revalidatePath(`/books/pages/${pageId}`);
}

export async function removePage(formData: FormData) {
  await requireUser();
  const db = userClient();
  const pageId = String(formData.get("page_id"));
  const bookId = String(formData.get("book_id"));
  await db.from("book_pages").delete().eq("id", pageId);
  // Renumber to keep the plan contiguous.
  const { data: pages } = await db
    .from("book_pages")
    .select("id, page_number")
    .eq("book_id", bookId)
    .order("page_number");
  let n = 1;
  for (const p of pages ?? []) {
    if (p.page_number !== n) await db.from("book_pages").update({ page_number: n }).eq("id", p.id);
    n++;
  }
  const { data: book } = await db.from("books").select("child_id").eq("id", bookId).single();
  await db.from("books").update({ page_count: (pages ?? []).length }).eq("id", bookId);
  revalidatePath(`/books/${bookId}`);
}

// -------------------------------------------------------------- approval

export async function approveBook(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const bookId = String(formData.get("book_id"));
  const confirmed = formData.get("confirm") === "on";
  if (!confirmed) redirect(`/books/${bookId}/approve?error=Please confirm your review`);

  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");
  if (book.status !== "review") redirect(`/books/${bookId}`);

  // Approval is recorded with the exact revision details (§21). The print
  // PDF checksum is recorded once rendering completes, keyed to this approval.
  const admin = adminClient();
  const approvedAt = new Date().toISOString();
  await admin.from("books").update({ status: "approved", approved_at: approvedAt }).eq("id", bookId);
  await admin.from("book_approvals").insert({
    book_id: bookId,
    approved_by: user.id,
    approved_at: approvedAt,
    pdf_checksum: sha256(Buffer.from(`${bookId}:${approvedAt}`)), // placeholder until render completes
    page_count: book.page_count ?? 0,
    provider_sku: process.env.PRODIGI_BOOK_SKU ?? "BOOK-A4-HARD-M",
  });
  await enqueue(admin, "render_pdf", { book_id: bookId, target: "print" }, `render-print-${bookId}-${approvedAt}`);
  await enqueue(admin, "render_pdf", { book_id: bookId, target: "digital" }, `render-digital-${bookId}-${approvedAt}`);
  redirect(`/books/${bookId}/checkout`);
}

// -------------------------------------------------------------- checkout

export async function startCheckout(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const bookId = String(formData.get("book_id"));
  const kind = String(formData.get("kind")) === "print" ? ("print" as const) : ("digital" as const);
  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");

  if (kind === "print") {
    // Persist recipient as a draft print order; submitted only after payment.
    const recipient = {
      name: String(formData.get("name") ?? ""),
      line1: String(formData.get("line1") ?? ""),
      line2: String(formData.get("line2") ?? "") || undefined,
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? "") || undefined,
      postcode: String(formData.get("postcode") ?? ""),
      countryCode: String(formData.get("country") ?? "AU"),
    };
    const admin = adminClient();
    await admin.from("print_orders").upsert(
      {
        book_id: bookId,
        provider: process.env.PRINT_PROVIDER ?? "mock",
        sku: process.env.PRODIGI_BOOK_SKU ?? "BOOK-A4-HARD-M",
        page_count: book.page_count ?? 0,
        recipient_json: recipient,
        status: "draft",
        idempotency_key: `print-${bookId}`,
      },
      { onConflict: "idempotency_key" }
    );
  }

  const { data: profile } = await db.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  const session = await createBookCheckout({
    kind,
    bookId,
    bookTitle: book.title,
    customerEmail: user.email!,
    stripeCustomerId: profile?.stripe_customer_id,
  });
  redirect(session.url!);
}

// ----------------------------------------------------------------- admin

export async function adminRetryJob(formData: FormData) {
  await requireAdmin();
  await retry(adminClient(), String(formData.get("job_id")));
  revalidatePath("/admin");
}
