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
import { AUTORENEW_TERMS, clampExtraCopies, createBookCheckout } from "@/lib/stripe";
import { compatibleArchetypes, type ArchetypeId } from "@/lib/book/templates";
import { sha256 } from "@/lib/media";
import { randomBytes } from "node:crypto";
import { roleForSubject, roleInFamily } from "@/lib/family/membership";
import {
  canComment, canEdit, canManageAccess, canModerate, statusForNewMemory,
} from "@/lib/family/roles";
import { record, safeDetail } from "@/lib/privacy/activity";
import { requireSecondFactor, StepUpRequired, stepUpPath } from "@/lib/auth/step-up";
import type { ProtectedAction } from "@/lib/auth/mfa";
import { sendOnce } from "@/lib/email/send";
import { invitation as invitationEmail } from "@/lib/email/messages";

function anonAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Stop an irreversible action until this session has proved itself again.
 *
 * Redirects rather than throwing, because a server action that throws lands
 * a parent on an error page having no idea what to do. `redirect` throws its
 * own control-flow signal, so this must be called before any work is done —
 * never after a row has been written.
 *
 * Passes straight through for an account with no second factor enrolled;
 * there is nothing to ask for. See lib/auth/mfa.ts for why that is the right
 * answer rather than a hole.
 */
async function gateOn(action: ProtectedAction, back: string) {
  try {
    await requireSecondFactor(action);
  } catch (err) {
    if (err instanceof StepUpRequired) redirect(stepUpPath(action, back));
    throw err;
  }
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
  const firstName = String(formData.get("display_name") ?? "").trim();
  const dob = String(formData.get("date_of_birth") ?? "");
  if (!firstName || !dob) redirect("/onboarding?error=Name and birthday are required");

  const { data: family, error: famErr } = await db
    .from("families")
    .insert({ owner_user_id: user.id })
    .select("id")
    .single();
  if (famErr) throw new Error(famErr.message);

  // Access is membership now, so the owner needs their row before anything
  // else is written — without it the very next insert is refused by RLS and
  // the person who just created the family cannot see it.
  const { error: memberErr } = await db
    .from("family_memberships")
    .insert({ family_id: family.id, user_id: user.id, role: "owner" });
  if (memberErr) throw new Error(memberErr.message);

  const { data: child, error: childErr } = await db
    .from("subjects")
    .insert({
      family_id: family.id,
      display_name: firstName,
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
  const subjectId = String(formData.get("subject_id"));
  const { data: child } = await db.from("subjects").select("family_id").eq("id", subjectId).single();
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
  redirect(`/subjects/${subjectId}/upload?welcome=1`);
}

// -------------------------------------------------------------- memories

/** Called after the client has uploaded bytes directly to private storage. */
export async function registerUploadedPhoto(input: {
  subjectId: string;
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
    .select("id, memories!inner(subject_id)")
    .eq("checksum", input.checksum)
    .eq("memories.subject_id", input.subjectId);
  if (dupes && dupes.length > 0) return { duplicate: true as const };

  const membership = await roleForSubject(db, input.subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  const { data: memory, error } = await db
    .from("memories")
    .insert({
      subject_id: input.subjectId,
      created_by: user.id,
      type: "photo",
      memory_date: input.memoryDate,
      metadata: {},
      contribution_status: statusForNewMemory(membership.role),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Everything the browser said about this file is written down as a claim,
  // not as fact — the scan job reads the bytes and corrects all of it. Until
  // then scan_verdict is 'pending', which is what keeps the file from being
  // served, laid out or printed.
  const { data: asset, error: assetErr } = await db
    .from("media_assets")
    .insert({
      memory_id: memory.id,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      width: input.width,
      height: input.height,
      capture_timestamp: input.captureTimestamp,
      checksum: input.checksum,
      processing_status: "pending",
    })
    .select("id")
    .single();
  if (assetErr || !asset) throw new Error(assetErr?.message ?? "could not record that file");

  // One job per file, and deliberately not batched the way analysis is: this
  // one gates whether the photograph is ever shown, so a parent watching an
  // upload finish should not wait on an hour window to see it.
  await enqueue(adminClient(), "scan_asset", { asset_id: asset.id }, `scan-${asset.id}`);

  // Queue analysis in batches — one job per child per hour window.
  const window = Math.floor(Date.now() / (60 * 60 * 1000));
  await enqueue(adminClient(), "analyse_memories", { subject_id: input.subjectId }, `analyse-${input.subjectId}-${window}`);
  return { duplicate: false as const, memoryId: memory.id, assetId: asset.id };
}

/** Voice memory: recording already uploaded to private storage by the client. */
export async function registerVoiceMemory(input: {
  subjectId: string;
  storagePath: string;
  checksum: string;
  mimeType: string;
  durationSeconds: number;
  transcript: string;
  memoryDate: string | null;
}) {
  const user = await requireUser();
  const db = userClient();

  const membership = await roleForSubject(db, input.subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  const { data: memory, error } = await db
    .from("memories")
    .insert({
      subject_id: input.subjectId,
      created_by: user.id,
      type: "voice",
      // The parent's own transcription — never a machine guess (§29).
      transcript: input.transcript,
      raw_text: input.transcript,
      memory_date: input.memoryDate,
      metadata: {},
      contribution_status: statusForNewMemory(membership.role),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // A recording made in the browser is still an upload, and gets the same
  // treatment: the recorder is our code but the bytes arriving at storage
  // are not something the server watched happen.
  const { data: asset, error: assetErr } = await db
    .from("media_assets")
    .insert({
      memory_id: memory.id,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      duration_seconds: input.durationSeconds,
      checksum: input.checksum,
      processing_status: "complete",
    })
    .select("id")
    .single();
  if (assetErr || !asset) throw new Error(assetErr?.message ?? "could not record that recording");

  await enqueue(adminClient(), "scan_asset", { asset_id: asset.id }, `scan-${asset.id}`);

  revalidatePath(`/subjects/${input.subjectId}`);
  return { memoryId: memory.id, assetId: asset.id };
}

export async function addTextMemory(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const subjectId = String(formData.get("subject_id"));
  const type = String(formData.get("type")) === "quote" ? "quote" : "text";
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  // A grandparent's note waits for the parent; a parent's does not.
  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  await db.from("memories").insert({
    subject_id: subjectId,
    created_by: user.id,
    type,
    raw_text: text,
    memory_date: String(formData.get("memory_date") ?? "") || null,
    contribution_status: statusForNewMemory(membership.role),
    visibility: formData.get("private") === "on" ? "private" : "family",
  });
  revalidatePath(`/subjects/${subjectId}`);
}

/**
 * Change who a memory is for, after the fact.
 *
 * Only the person who wrote it. An owner who could un-private somebody
 * else's note would make the word meaningless — and the other direction is
 * no better, since hiding another parent's memory from them is not privacy,
 * it is removal.
 */
export async function setMemoryVisibility(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const memoryId = String(formData.get("memory_id"));
  const subjectId = String(formData.get("subject_id"));
  const visibility = String(formData.get("visibility")) === "private" ? "private" : "family";

  await db
    .from("memories")
    .update({ visibility })
    .eq("id", memoryId)
    .eq("created_by", user.id);

  // Sharing something previously private makes it new material for the book,
  // so the patterns are read again. Making something private does not — the
  // next generation simply stops seeing it.
  if (visibility === "family") {
    const window = Math.floor(Date.now() / (60 * 60 * 1000));
    await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);
  }
  revalidatePath(`/subjects/${subjectId}/years`);
}

export async function addLittleThing(formData: FormData) {
  await requireUser();
  const db = userClient();
  const subjectId = String(formData.get("subject_id"));
  const category = String(formData.get("category") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  if (!category || !value) return;
  await db.from("little_things").insert({ subject_id: subjectId, category, value });
  revalidatePath(`/subjects/${subjectId}/little-things`);
}

// -------------------------------------------------------------- clusters

export async function updateCluster(formData: FormData) {
  await requireUser();
  const db = userClient();
  const clusterId = String(formData.get("cluster_id"));
  const action = String(formData.get("action"));
  const subjectId = String(formData.get("subject_id"));

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
  revalidatePath(`/subjects/${subjectId}/clusters`);
}

// -------------------------------------------------------------- questions

export async function answerQuestion(formData: FormData) {
  await requireUser();
  const db = userClient();
  const id = String(formData.get("question_id"));
  const subjectId = String(formData.get("subject_id"));
  const action = String(formData.get("action"));
  if (action === "dismiss") {
    await db.from("follow_up_questions").update({ status: "dismissed" }).eq("id", id);
  } else {
    const answer = String(formData.get("answer") ?? "").trim();
    if (answer) {
      await db.from("follow_up_questions").update({ status: "answered", answer }).eq("id", id);
    }
  }
  revalidatePath(`/subjects/${subjectId}/questions`);
}

// ------------------------------------------------------------------ book

export async function createBook(formData: FormData) {
  await requireUser();
  const db = userClient();
  const subjectId = String(formData.get("subject_id"));
  const { data: child } = await db.from("subjects").select("*").eq("id", subjectId).single();
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
    .eq("subject_id", subjectId)
    .eq("year_number", yearNumber)
    .maybeSingle();
  if (existing) redirect(`/books/${existing.id}`);

  const { data: book, error } = await db
    .from("books")
    .insert({
      subject_id: subjectId,
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
  const allowed = compatibleArchetypes(page.template_id as ArchetypeId, "hero")
    .some((t: { id: string }) => t.id === templateId);
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
  const { data: book } = await db.from("books").select("subject_id").eq("id", bookId).single();
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

  // Mint the listen token now, so the QR codes printed on the page resolve —
  // and so a draft book's codes never could.
  await admin.rpc("mint_listen_token", { bid: bookId });

  await enqueue(admin, "render_pdf", { book_id: bookId, target: "print" }, `render-print-${bookId}-${approvedAt}`);
  await enqueue(admin, "render_pdf", { book_id: bookId, target: "digital" }, `render-digital-${bookId}-${approvedAt}`);
  redirect(`/books/${bookId}/checkout`);
}

// -------------------------------------------------------------- checkout

export async function startCheckout(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const bookId = String(formData.get("book_id"));
  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");

  // One product: the printed book, digital included. Extra copies ride along
  // on the same run, so the count belongs on the print order.
  const extraCopies = clampExtraCopies(formData.get("extra_copies"));

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
      copies: extraCopies + 1,
      status: "draft",
      idempotency_key: `print-${bookId}`,
    },
    { onConflict: "idempotency_key" }
  );

  // Only ever from an explicit tick, and the exact wording they agreed to is
  // stored alongside the flag — "did they consent" is the whole question in
  // a dispute, and a boolean cannot answer it.
  const autorenew = formData.get("autorenew") === "on";
  if (autorenew) {
    await db
      .from("subjects")
      .update({
        autorenew_enabled: true,
        autorenew_agreed_at: new Date().toISOString(),
        autorenew_agreed_terms: AUTORENEW_TERMS,
      })
      .eq("id", book.subject_id);
  }

  const { data: profile } = await db.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  const session = await createBookCheckout({
    bookId,
    bookTitle: book.title,
    customerEmail: user.email!,
    extraCopies,
    stripeCustomerId: profile?.stripe_customer_id,
    saveCardForRenewal: autorenew,
  });
  redirect(session.url!);
}

/**
 * Stop a renewal from the link in an email, without a login.
 *
 * The id is the credential, which is a deliberate trade: this route can only
 * ever *prevent* a payment, so a leaked link cannot cost anyone anything. The
 * alternative — making people log in to stop a charge — turns cancellations
 * into chargebacks.
 */
export async function stopRenewalByLink(formData: FormData) {
  const renewalId = String(formData.get("renewal_id"));
  const admin = adminClient();

  const { data: renewal } = await admin
    .from("renewals")
    .select("id, subject_id, status")
    .eq("id", renewalId)
    .maybeSingle();
  if (!renewal || renewal.status !== "scheduled") redirect(`/renewals/${renewalId}/cancel`);

  await admin
    .from("renewals")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", renewalId)
    .eq("status", "scheduled");
  await admin.from("subjects").update({ autorenew_enabled: false }).eq("id", renewal.subject_id);

  redirect(`/renewals/${renewalId}/cancel?done=1`);
}

/** Stop a scheduled renewal. One click, no reason asked for. */
export async function cancelRenewal(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const renewalId = String(formData.get("renewal_id"));
  const subjectId = String(formData.get("subject_id"));

  await db
    .from("renewals")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
    })
    .eq("id", renewalId)
    .eq("status", "scheduled");

  // Turning off the coming charge turns off the arrangement. Leaving it on
  // so it silently returns next year is the trick this is avoiding.
  await db.from("subjects").update({ autorenew_enabled: false }).eq("id", subjectId);
  revalidatePath(`/subjects/${subjectId}`);
}

// ------------------------------------------------------- shared archive
//
// Everything below concerns more than one person having access to a child's
// archive. The database enforces who may see what; these actions enforce the
// finer rules about what each role may do, and they ask the same questions
// the RLS policies ask so the two cannot drift.

/** Invite someone to a family. Owner only; never as owner. */
export async function inviteToFamily(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const familyId = String(formData.get("family_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) === "editor" ? "editor" : "contributor";
  const displayName = String(formData.get("display_name") ?? "").trim();
  const back = `/family/${familyId}`;

  if (!email.includes("@")) redirect(`${back}?error=${encodeURIComponent("That doesn't look like an email address")}`);

  const role_ = await roleInFamily(db, familyId, user.id);
  if (!canManageAccess(role_)) {
    redirect(`${back}?error=${encodeURIComponent("Only the person who keeps this archive can invite people")}`);
  }

  // Single-use and unguessable. This is the whole credential, so it is
  // generated with the crypto RNG rather than anything derived from time.
  const token = randomBytes(32).toString("base64url");

  const { error } = await db.from("family_invitations").insert({
    family_id: familyId,
    email,
    role,
    token,
    invited_by: user.id,
  });
  // A pending invitation for the same address already exists.
  if (error) redirect(`${back}?error=${encodeURIComponent("They have already been invited")}`);

  if (displayName) {
    await db.from("family_members").insert({
      family_id: familyId, name: displayName, relationship: role === "editor" ? "parent" : "family",
    });
  }

  // Send it. The link is still shown to the inviter afterwards, because a
  // grandparent's mail provider is not to be trusted with something they are
  // waiting for, and passing it on by hand should always be possible.
  const admin = adminClient();
  const { data: subjects } = await admin
    .from("subjects").select("display_name").eq("family_id", familyId).limit(1);
  const { data: inviter } = await admin
    .from("profiles").select("email").eq("id", user.id).maybeSingle();

  await sendOnce(admin, {
    kind: "invitation",
    dedupeKey: `invitation-${token}`,
    subjectId: null,
    message: invitationEmail({
      to: { email },
      childName: subjects?.[0]?.display_name ?? "their grandchild",
      invitedByName: inviter?.email?.split("@")[0] ?? "Someone",
      token,
    }),
  });

  redirect(`${back}?invited=${encodeURIComponent(token)}`);
}

/** Accept an invitation. The token is the only thing the invitee needs. */
export async function acceptInvitation(formData: FormData) {
  const user = await requireUser();
  const admin = adminClient();
  const token = String(formData.get("token") ?? "");

  const { data: invite } = await admin
    .from("family_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) redirect("/home?error=" + encodeURIComponent("That invitation link is not valid"));
  if (invite.accepted_at) redirect("/home?error=" + encodeURIComponent("That invitation has already been used"));
  if (new Date(invite.expires_at) < new Date()) {
    redirect("/home?error=" + encodeURIComponent("That invitation has expired — ask for a new one"));
  }

  // Service role, because the invitee is by definition not yet a member and
  // so cannot write their own membership row under RLS.
  const { error } = await admin.from("family_memberships").upsert(
    { family_id: invite.family_id, user_id: user.id, role: invite.role, invited_by: invite.invited_by },
    { onConflict: "family_id,user_id" }
  );
  if (error) throw new Error(error.message);

  await admin
    .from("family_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  redirect("/home");
}

/** Change what someone may do, or remove their access entirely. */
export async function updateMembership(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const membershipId = String(formData.get("membership_id"));
  const familyId = String(formData.get("family_id"));
  const action = String(formData.get("action"));

  // Before any work, and after familyId is known so the confirmation screen
  // can send them back to the right page.
  await gateOn("change_access", `/family/${familyId}`);

  const role = await roleInFamily(db, familyId, user.id);
  if (!canManageAccess(role)) throw new Error("only the owner can change access");

  if (action === "remove") {
    await db.from("family_memberships").delete().eq("id", membershipId);
  } else if (action === "editor" || action === "contributor") {
    await db.from("family_memberships").update({ role: action }).eq("id", membershipId);
  }
  revalidatePath(`/family/${familyId}`);
}

/** Accept or decline something a contributor added. */
export async function reviewContribution(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const memoryId = String(formData.get("memory_id"));
  const subjectId = String(formData.get("subject_id"));
  const decision = String(formData.get("decision")) === "approve" ? "approved" : "declined";

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!canModerate(membership?.role ?? null)) throw new Error("not allowed to review contributions");

  await db
    .from("memories")
    .update({
      contribution_status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", memoryId);

  // An accepted contribution joins the archive, so it must be read into the
  // patterns like anything else. A declined one changes nothing.
  if (decision === "approved") {
    const window = Math.floor(Date.now() / (60 * 60 * 1000));
    await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);
  }
  revalidatePath(`/subjects/${subjectId}/review`);
  revalidatePath(`/subjects/${subjectId}`);
}

/** Say something about a memory. Conversation, never book content. */
export async function addComment(formData: FormData) {
  const user = await requireUser();
  const db = userClient();
  const memoryId = String(formData.get("memory_id"));
  const subjectId = String(formData.get("subject_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!canComment(membership?.role ?? null)) throw new Error("not a member of this family");

  await db.from("memory_comments").insert({
    memory_id: memoryId,
    author_user_id: user.id,
    body: body.slice(0, 2000),
  });
  revalidatePath(`/subjects/${subjectId}/years`);
}

export async function deleteComment(formData: FormData) {
  await requireUser();
  const db = userClient();
  await db.from("memory_comments").delete().eq("id", String(formData.get("comment_id")));
  revalidatePath(`/subjects/${String(formData.get("subject_id"))}/years`);
}

/**
 * What we may write to someone about.
 *
 * Reachable from a token in an email footer as well as from a session, so a
 * person can stop the mail without remembering a password — which is the
 * difference between an unsubscribe link and a mark-as-spam.
 */
export async function updateNotificationPreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const prefs = {
    contributions_waiting: formData.get("contributions_waiting") === "on",
    year_closing: formData.get("year_closing") === "on",
    updated_at: new Date().toISOString(),
  };

  if (token) {
    const admin = adminClient();
    await admin.from("email_preferences").update(prefs).eq("opt_out_token", token);
    redirect(`/settings/notifications?t=${encodeURIComponent(token)}&saved=1`);
  }

  const user = await requireUser();
  await userClient()
    .from("email_preferences")
    .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
  redirect("/settings/notifications?saved=1");
}

// --------------------------------------------------------------- privacy

/** Ask for a copy of everything. Anyone who can edit may take one. */
export async function requestExport(formData: FormData) {
  const user = await requireUser();
  await gateOn("export_archive", `/settings/privacy`);
  const db = userClient();
  const familyId = String(formData.get("family_id"));

  const role = await roleInFamily(db, familyId, user.id);
  if (!canEdit(role)) throw new Error("not allowed to export this archive");

  const { data: created, error } = await db
    .from("archive_exports")
    .insert({ family_id: familyId, requested_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const admin = adminClient();
  await enqueue(admin, "build_export", { export_id: created.id, family_id: familyId }, `export-${created.id}`);
  await record(admin, {
    familyId,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "Someone",
    kind: "exported_archive",
  });

  revalidatePath(`/settings/privacy`);
  redirect("/settings/privacy?export=preparing");
}

/**
 * Delete everything. Irreversible, and treated as such: the owner must type
 * the child's name, which is not friction for its own sake — it is the
 * difference between a decision and a misclick on a phone.
 */
export async function deleteEverything(formData: FormData) {
  const user = await requireUser();
  await gateOn("delete_everything", `/settings/privacy`);
  const db = userClient();
  const familyId = String(formData.get("family_id"));
  const typed = String(formData.get("confirmation") ?? "").trim();

  const role = await roleInFamily(db, familyId, user.id);
  if (!canManageAccess(role)) throw new Error("only the owner can delete this archive");

  const { data: subjects } = await db
    .from("subjects")
    .select("display_name")
    .eq("family_id", familyId)
    .limit(1);
  const expected = subjects?.[0]?.display_name ?? "";

  if (!expected || typed.toLowerCase() !== expected.toLowerCase()) {
    redirect(`/settings/privacy?error=${encodeURIComponent(`Type ${expected} exactly to confirm`)}`);
  }

  const { data: request, error } = await db
    .from("deletion_requests")
    .insert({ family_id: familyId, requested_by: user.id, confirmation: typed })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const admin = adminClient();
  await enqueue(admin, "erase_family", { family_id: familyId, request_id: request.id }, `erase-${request.id}`);
  redirect("/settings/privacy?deleted=1");
}

/**
 * Let support look, for a fixed period, because the family asked. Nobody
 * here browses a family's memories otherwise.
 */
export async function grantSupportAccess(formData: FormData) {
  const user = await requireUser();
  await gateOn("grant_support_access", `/settings/privacy`);
  const db = userClient();
  const familyId = String(formData.get("family_id"));
  const reason = String(formData.get("reason") ?? "").trim() || "support request";

  const role = await roleInFamily(db, familyId, user.id);
  if (!canManageAccess(role)) throw new Error("only the owner can grant access");

  const expires = new Date();
  expires.setHours(expires.getHours() + 48);

  await db.from("support_grants").insert({
    family_id: familyId,
    granted_by: user.id,
    reason,
    expires_at: expires.toISOString(),
  });
  await record(adminClient(), {
    familyId,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "Someone",
    kind: "support_access_granted",
    detail: safeDetail(reason),
  });
  revalidatePath("/settings/privacy");
}

export async function revokeSupportAccess(formData: FormData) {
  await requireUser();
  const db = userClient();
  await db
    .from("support_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", String(formData.get("grant_id")));
  revalidatePath("/settings/privacy");
}

// ----------------------------------------------------------------- admin

export async function adminRetryJob(formData: FormData) {
  await requireAdmin();
  await retry(adminClient(), String(formData.get("job_id")));
  revalidatePath("/admin");
}
