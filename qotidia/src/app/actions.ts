"use server";

// Server actions — all user-facing writes. Every action runs against the
// RLS-enforced user client, so ownership is enforced by the database even
// if a bug slips in here. The service-role client appears only where the
// brief requires server authority (approval audit, checkout, admin).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ACCESS_COOKIE, REFRESH_COOKIE, adminClient, authClient, requireAdmin, requireUser,
  userClient,
} from "@/lib/supabase/server";
import { enqueue, retry } from "@/lib/jobs/queue";
import {
  AUTORENEW_TERMS, PRICES, clampExtraCopies, createBookCheckout,
  createMembershipCheckout, endMembership, resumeMembership,
} from "@/lib/stripe";
import { bookPriceFor } from "@/lib/billing/price";
import { compatibleArchetypes, type ArchetypeId } from "@/lib/book/templates";
import { sha256 } from "@/lib/media";
import { randomBytes } from "node:crypto";
import { roleForSubject, roleInFamily } from "@/lib/family/membership";
import { keepMemory, linkMemoryToSubjects, storySubject } from "@/lib/memories/scope";
import { parseKey, toggleWho } from "@/lib/memories/who";
import { periodFor } from "@/lib/book/period";
import {
  canComment, canEdit, canManageAccess, canModerate, statusForNewMemory,
} from "@/lib/family/roles";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";
import { record, safeDetail } from "@/lib/privacy/activity";
import { requireSecondFactor, StepUpRequired, stepUpPath } from "@/lib/auth/step-up";
import type { ProtectedAction } from "@/lib/auth/mfa";
import { colourById } from "@/lib/book/colours";
import { sendOnce } from "@/lib/email/send";
import { invitation as invitationEmail } from "@/lib/email/messages";
import { recordAnswer } from "@/lib/graph/identity-store";
import { loadEntities } from "@/lib/graph/extract";
import { peopleBooksFor } from "@/lib/book/people-books";
import { roomToAdd } from "@/lib/storage/usage";
import { mayKeepMore } from "@/lib/billing/standing";
import { note } from "@/lib/analytics/record";
import { getObjectStore, TTL } from "@/lib/storage/provider";
import { keeperNamed as keeperNamedEmail } from "@/lib/email/messages";
import { SETTLING_DAYS, mayClaim } from "@/lib/succession/policy";
import { openClaim } from "@/lib/succession/run";
import { recordContext } from "@/lib/graph/context-store";
import {
  TOKEN_SHAPE, accept, expiresAtFrom, newToken, reachable,
} from "@/lib/share/policy";
import type { Wondering } from "@/lib/graph/context";


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

async function setSessionCookies(accessToken: string, refreshToken: string) {
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  // One await, one jar. The codemod's synchronous unwrap called cookies()
  // twice and would have gone on working right up until it didn't.
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, { ...opts, maxAge: 60 * 60 });
  jar.set(REFRESH_COOKIE, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
}

// ----------------------------------------------------------------- auth

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // Which plan they came in on. Carried through onboarding rather than acted
  // on here: nobody should be charged before they have told us a child's
  // name, and a monthly plan started against an empty archive is a
  // subscription to nothing.
  const plan = String(formData.get("plan") ?? "") === "monthly" ? "monthly" : "one_off";

  const { data, error } = await authClient().auth.signUp({ email, password });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}&plan=${plan}`);
  if (data.session) {
    await setSessionCookies(data.session.access_token, data.session.refresh_token);
    void note(adminClient(), data.session.user.id, { name: "signed_up" });
    redirect(`/onboarding?plan=${plan}`);
  }
  redirect("/login?message=Check your email to confirm your account");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Sign in failed")}`);
  await setSessionCookies(data.session.access_token, data.session.refresh_token);
  redirect("/home");
}

export async function signOut() {
  (await cookies()).delete(ACCESS_COOKIE);
  (await cookies()).delete(REFRESH_COOKIE);
  redirect("/");
}

// ------------------------------------------------------------ onboarding

export async function createChild(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
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
  void note(db, user.id, { name: "subject_created" });
  // Straight to the choice of which year to start with. The people step
  // follows from the upload screen rather than blocking it: naming
  // grandparents is useful and is not what anyone came here to do, and it
  // was standing between a new family and the first useful thing.
  redirect(`/onboarding/start?child=${child.id}`);
}

export async function addFamilyMembers(formData: FormData) {
  await requireUser();
  const db = await userClient();
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

/**
 * What a browser is allowed to store.
 *
 * The type here becomes the Content-Type the file is served back with, so
 * this is not a convenience list — it is the reason a signed URL cannot
 * return text/html from our own origin. The scan job checks the actual bytes
 * afterwards and refuses anything that is not what it claimed; this stops
 * the claim itself from being dangerous in the meantime.
 */
const STORABLE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/**
 * Permission to put one file in one place.
 *
 * Browsers used to upload straight to Supabase with row-level security on
 * the bucket deciding whether they were allowed. That check cannot move to
 * an object store that has no such thing, so it moves here, where it is the
 * same check under every provider: are you in this family, and is there
 * room.
 *
 * **The path is computed here, not accepted from the caller.** It is built
 * from the authenticated user's own id, so there is no request a client can
 * send that writes into somebody else's prefix. That used to be true only
 * because a storage policy said so.
 */
export async function uploadTicket(input: {
  subjectId: string;
  checksum: string;
  contentType: string;
  bytes: number;
}) {
  const user = await requireUser();
  const db = await userClient();
  const membership = await roleForSubject(db, input.subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");
  const story = await storySubject(db, input.subjectId);
  if (!story) throw new Error("no such subject");

  // MediaRecorder reports "audio/webm;codecs=opus", and the parameters are
  // not part of what we are deciding about. Stripped before the lookup and
  // the stripped value is what gets signed and stored, so the Content-Type
  // a file is served with is one from the list above rather than a string
  // the browser composed.
  const contentType = input.contentType.split(";")[0].trim().toLowerCase();
  const extension = STORABLE[contentType];
  if (!extension) throw new Error(`we cannot keep ${contentType || "that kind of file"}`);

  // Checked before the bytes move rather than after, so a family that is out
  // of room is told instead of spending their upload allowance discovering
  // it. registerUploadedPhoto checks again — this is the polite version, not
  // the authoritative one.
  const bytes = Math.max(0, Math.round(input.bytes));
  const room = await roomToAdd(db, story.family_id, bytes);
  if (!room.ok) {
    return { ok: false as const, message: room.message ?? "There's no room left." };
  }

  // Unchanged from what the browser used to build, so nothing already stored
  // has to move. The checksum makes it idempotent: the same photograph
  // uploaded twice lands on itself rather than accumulating copies.
  const safeChecksum = /^[a-f0-9]{64}$/.test(input.checksum) ? input.checksum : null;
  if (!safeChecksum) throw new Error("bad checksum");
  const storagePath = `${user.id}/${input.subjectId}/${safeChecksum}.${extension}`;

  const ticket = await getObjectStore().writeTicket("media", storagePath, TTL.upload, {
    contentType,
    contentLength: bytes,
  });

  return { ok: true as const, storagePath, contentType, ...ticket };
}

/**
 * Take back a file whose row was never written.
 *
 * The browser cannot delete from the store directly any more — there is no
 * client credential to do it with — so the one case that needs it, an upload
 * accepted by the bucket and then refused by the quota, comes back here.
 * Scoped to the caller's own prefix, which is the same rule the ticket
 * above enforces on the way in.
 */
export async function discardUpload(storagePath: string) {
  const user = await requireUser();
  if (!storagePath.startsWith(`${user.id}/`)) throw new Error("not yours to remove");

  // Refuse if anything actually references it. A path is reused across
  // subjects by design — the same checksum is the same file — so a stale
  // "clean up after yourself" call must never take a live photograph with
  // it.
  const { data: existing } = await adminClient()
    .from("media_assets")
    .select("id")
    .eq("storage_path", storagePath)
    .limit(1);
  if (existing?.length) return { removed: false as const };

  await getObjectStore().remove("media", [storagePath]);
  return { removed: true as const };
}

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
  /** What the browser says the file weighs. Corrected by the scan job. */
  bytes: number;
}) {
  const user = await requireUser();
  const db = await userClient();

  // Exact-duplicate detection (§7): same checksum for this child is skipped.
  const membership = await roleForSubject(db, input.subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");
  const story = await storySubject(db, input.subjectId);
  if (!story) throw new Error("no such subject");

  // Duplicate detection is now per archive rather than per subject. The same
  // photograph dropped in twice — once on Florence's page, once on Theo's —
  // is one photograph in one family's archive that is about both of them,
  // and keeping two copies would double it in every count.
  const { data: dupes } = await db
    .from("media_assets")
    .select("id, memory_id, memories!inner(family_id)")
    .eq("checksum", input.checksum)
    .eq("memories.family_id", story.family_id);
  if (dupes && dupes.length > 0) {
    // Still say it is about this subject: the second upload was somebody
    // telling us something true that we did not already know.
    await linkMemoryToSubjects(db, (dupes[0] as any).memory_id, [input.subjectId]);
    return { duplicate: true as const };
  }

  // The authoritative check, after the duplicate test — a file the archive
  // already holds costs nothing and must not be refused for space. Checked
  // per file rather than only per batch, because a batch estimate made on
  // the client is a number anybody can send.
  const room = await roomToAdd(db, story.family_id, input.bytes);
  if (!room.ok) {
    return { full: true as const, message: room.message ?? "There's no room left." };
  }

  // Two different limits with two different sentences. Bytes is a storage
  // question with an answer you can buy more of; the free cap is a question
  // about the plan. Telling a family on the free tier that they are out of
  // space would send them to the wrong page.
  const kept = await mayKeepMore(db, story.family_id, 1);
  if (!kept.ok) {
    void note(db, user.id, { name: "free_cap_reached" });
    return { full: true as const, message: kept.message ?? "There's no room left." };
  }

  const memoryId = await keepMemory(db, {
    familyId: story.family_id,
    about: [input.subjectId],
    memory: {
      created_by: user.id,
      type: "photo",
      memory_date: input.memoryDate,
      metadata: {},
      contribution_status: statusForNewMemory(membership.role),
    },
  });
  if (!memoryId) throw new Error("could not keep that");
  void note(db, user.id, { name: "upload_finished", count: 1 });
  const memory = { id: memoryId };

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
      bytes: Math.max(0, Math.round(input.bytes)),
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
  const db = await userClient();

  const membership = await roleForSubject(db, input.subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");
  const story = await storySubject(db, input.subjectId);
  if (!story) throw new Error("no such subject");

  const memoryId = await keepMemory(db, {
    familyId: story.family_id,
    about: [input.subjectId],
    memory: {
      created_by: user.id,
      type: "voice",
      // The parent's own transcription — never a machine guess (§29).
      transcript: input.transcript,
      raw_text: input.transcript,
      memory_date: input.memoryDate,
      metadata: {},
      contribution_status: statusForNewMemory(membership.role),
    },
  });
  if (!memoryId) throw new Error("could not keep that recording");
  void note(db, user.id, { name: "memory_written" });
  const memory = { id: memoryId };

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
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const type = String(formData.get("type")) === "quote" ? "quote" : "text";
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  // A grandparent's note waits for the parent; a parent's does not.
  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  const story = await storySubject(db, subjectId);
  if (!story) throw new Error("no such subject");

  await keepMemory(db, {
    familyId: story.family_id,
    about: [subjectId],
    memory: {
      created_by: user.id,
      type,
      raw_text: text,
      memory_date: String(formData.get("memory_date") ?? "") || null,
      contribution_status: statusForNewMemory(membership.role),
      visibility: formData.get("private") === "on" ? "private" : "family",
    },
  });
  void note(db, user.id, { name: "memory_written" });
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
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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

/**
 * Answering one of the questions the archive asked.
 *
 * The answer is written twice, deliberately, and the second write is the
 * important one.
 *
 * Notice → Ask → Remember only closes if the *remembering* puts the answer
 * back where the noticing can find it. An answer stored on the question row
 * alone is read once, by the book generator, and is invisible to everything
 * else: the analysis never sees it, the clustering cannot group it, the
 * look-back can never show it back, next year's questions do not know it was
 * ever said, and the export — which promises everything a family kept —
 * silently omits it.
 *
 * Which would make the most considered sentences in the whole archive the
 * only second-class ones. A parent writes "Bun Bun. He came from Nana and he
 * goes everywhere" precisely because we asked; that is not a footnote to a
 * memory, it *is* a memory, and it should be one.
 */
export async function answerQuestion(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const id = String(formData.get("question_id"));
  const subjectId = String(formData.get("subject_id"));
  const action = String(formData.get("action"));

  if (action === "dismiss") {
    await db.from("follow_up_questions").update({ status: "dismissed" }).eq("id", id);
    revalidatePath(`/subjects/${subjectId}/questions`);
    return;
  }

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) {
    revalidatePath(`/subjects/${subjectId}/questions`);
    return;
  }

  // Read the question first: an answer without the question it answered is
  // a sentence with the subject removed. "Bun Bun" means nothing on its own.
  const { data: question } = await db
    .from("follow_up_questions")
    .select("question, status, answer_memory_id")
    .eq("id", id)
    .single();

  await db.from("follow_up_questions").update({ status: "answered", answer }).eq("id", id);

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  // Editing an answer updates the memory rather than adding a second one.
  void note(db, user.id, { name: "question_answered" });

  if (question?.answer_memory_id) {
    await db
      .from("memories")
      .update({ raw_text: answer })
      .eq("id", question.answer_memory_id);
    revalidatePath(`/subjects/${subjectId}/questions`);
    return;
  }

  const story = await storySubject(db, subjectId);
  const answerMemoryId = story
    ? await keepMemory(db, {
        familyId: story.family_id,
        about: [subjectId],
        memory: {
          created_by: user.id,
          type: "text",
          raw_text: answer,
          // Dated today, because today is when they wrote it. The thing it
          // is *about* is undated by nature — "he goes everywhere" has no day.
          memory_date: new Date().toISOString().slice(0, 10),
          metadata: { from_question_id: id, question: question?.question ?? null },
          contribution_status: statusForNewMemory(membership.role),
          visibility: "family",
        },
      })
    : null;
  const memory = answerMemoryId ? { id: answerMemoryId } : null;

  if (memory) {
    await db.from("follow_up_questions").update({ answer_memory_id: memory.id }).eq("id", id);
    // Same batching as every other capture path.
    const window = Math.floor(Date.now() / (60 * 60 * 1000));
    await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);
  }

  revalidatePath(`/subjects/${subjectId}/questions`);
}

// ------------------------------------------------------------------ book

export async function createBook(formData: FormData) {
  await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const { data: child } = await db.from("subjects").select("*").eq("id", subjectId).single();
  if (!child) throw new Error("child not found");

  // The period, from the one place that knows how each kind of book is
  // bounded. This used to work it out from a date of birth inline, which
  // meant a household book made here would have been given a child's year.
  const period = periodFor(child as any);

  const { data: existing } = await db
    .from("books")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("start_date", period.start)
    .maybeSingle();
  if (existing) redirect(`/books/${existing.id}`);

  const { data: book, error } = await db
    .from("books")
    .insert({
      subject_id: subjectId,
      year_number: period.yearNumber,
      title: period.title,
      start_date: period.start,
      end_date: period.end,
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
  const db = await userClient();
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
  const db = await userClient();
  await db.from("book_content_blocks").delete().eq("id", String(formData.get("block_id")));
  revalidatePath(`/books/pages/${String(formData.get("page_id"))}`);
}

export async function changeTemplate(formData: FormData) {
  await requireUser();
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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
    // Not the PDF's checksum — the file does not exist yet, and rendering is
    // enqueued four lines below. renderPdf writes the real one onto this row
    // once the bytes exist. Until then this is explicitly marked as pending
    // rather than filled with a plausible-looking hash: the point of the
    // field is to prove what was approved, and a fabricated hex string is
    // evidence-shaped and evidentially empty.
    pdf_checksum: "pending-render",
    page_count: book.page_count ?? 0,
    provider_sku: process.env.PRODIGI_BOOK_SKU ?? "BOOK-A4-HARD-M",
  });

  // Mint the listen token now, so the QR codes printed on the page resolve —
  // and so a draft book's codes never could.
  await admin.rpc("mint_listen_token", { bid: bookId });

  await enqueue(admin, "render_pdf", { book_id: bookId, target: "print" }, `render-print-${bookId}-${approvedAt}`);
  await enqueue(admin, "render_pdf", { book_id: bookId, target: "digital" }, `render-digital-${bookId}-${approvedAt}`);
  void note(admin, user.id, { name: "book_approved" });
  redirect(`/books/${bookId}/checkout`);
}

// -------------------------------------------------------------- checkout

export async function startCheckout(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const bookId = String(formData.get("book_id"));
  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");

  // One product: the printed book, digital included. Extra copies ride along
  // on the same run, so the count belongs on the print order.
  const extraCopies = clampExtraCopies(formData.get("extra_copies"));

  // The price is worked out here, from the family's plan — never taken from
  // the form. A page can be edited; this is where money is decided.
  const { data: subjectRow } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", book.subject_id)
    .single();
  const price = subjectRow
    ? await bookPriceFor(db, subjectRow.family_id)
    : { amountAud: PRICES.bookAud(), plan: "one_off" as const, monthsPaidThisYear: 0, creditAud: 0, explanation: null };

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
  // Nothing to pay: a member whose membership already covers this book must
  // not be sent to a checkout at all. A Stripe session for A$0 either fails
  // or asks someone for a card to be charged nothing, and both read as a
  // mistake by us.
  if (price.amountAud === 0 && extraCopies === 0) {
    const { data: draft } = await admin
      .from("print_orders")
      .select("id")
      .eq("book_id", bookId)
      .eq("status", "draft")
      .maybeSingle();
    if (draft) {
      await enqueue(admin, "submit_print", { print_order_id: draft.id }, `submit-${draft.id}`);
    }
    redirect(`/books/${bookId}?included=1`);
  }

  const session = await createBookCheckout({
    bookId,
    bookTitle: book.title,
    customerEmail: user.email!,
    extraCopies,
    bookAmountAud: price.amountAud,
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
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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
  const db = await userClient();
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
  await (await userClient())
    .from("email_preferences")
    .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
  redirect("/settings/notifications?saved=1");
}

// --------------------------------------------------------------- privacy

/** Ask for a copy of everything. Anyone who can edit may take one. */
export async function requestExport(formData: FormData) {
  const user = await requireUser();
  await gateOn("export_archive", `/settings/privacy`);
  const db = await userClient();
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
  void note(admin, user.id, { name: "archive_exported" });

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
  const db = await userClient();
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
  // Measured, and deliberately so. A number that only ever goes up when
  // something is going wrong is the number most worth being unable to hide
  // from ourselves.
  void note(admin, user.id, { name: "archive_deleted" });
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
  const db = await userClient();
  const familyId = String(formData.get("family_id"));
  const reason = String(formData.get("reason") ?? "").trim() || "support request";

  const role = await roleInFamily(db, familyId, user.id);
  if (!canManageAccess(role)) throw new Error("only the owner can grant access");

  const expires = new Date();
  expires.setHours(expires.getHours() + SUPPORT_ACCESS_HOURS);

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
  const db = await userClient();
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

// ------------------------------------------------------ cover colour

/**
 * Statuses past which a cover colour can no longer be changed.
 *
 * Once a file has been handed to the printer, the object exists — or is
 * about to. Letting the picker keep accepting changes after that would show
 * a parent a colour their book will never be, which is worse than telling
 * them the moment has passed.
 */
const COLOUR_LOCKED_AFTER = ["ordered", "in_production", "shipped", "delivered"];

async function assertCanRestyle(db: Awaited<ReturnType<typeof userClient>>, bookId: string, userId: string) {
  const { data: book } = await db
    .from("books")
    .select("id, subject_id, status")
    .eq("id", bookId)
    .single();
  if (!book) throw new Error("book not found");

  // A contributor may add to the archive but not restyle the object that
  // gets printed and posted to the whole family.
  const membership = await roleForSubject(db, book.subject_id, userId);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this cover");
  }
  return book;
}

/** Set (or clear) the colour of one volume. */
export async function setCoverColour(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const bookId = String(formData.get("book_id"));
  const raw = String(formData.get("colour") ?? "");

  const book = await assertCanRestyle(db, bookId, user.id);
  if (COLOUR_LOCKED_AFTER.includes(book.status)) {
    redirect(`/books/${bookId}?error=${encodeURIComponent("That book has already gone to print.")}`);
  }

  // An empty value is "back to the spectrum" and stores null. An id we do
  // not recognise is dropped rather than written — the column has no foreign
  // key behind it, so this is the only thing standing between a typo in a
  // form post and a cover that renders in whatever the fallback happens to be.
  const colour = colourById(raw)?.id ?? null;

  const { error } = await db.from("books").update({ cover_colour: colour }).eq("id", bookId);
  if (error) throw new Error(error.message);

  revalidatePath(`/books/${bookId}`);
  revalidatePath(`/subjects/${book.subject_id}`);
}

/** Set the standing preference: every volume this colour, unless set by hand. */
export async function setCoverColourForAll(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const raw = String(formData.get("colour") ?? "");

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change these covers");
  }

  const colour = colourById(raw)?.id ?? null;
  const { error } = await db.from("subjects").update({ cover_colour: colour }).eq("id", subjectId);
  if (error) throw new Error(error.message);

  // Deliberately does not touch books.cover_colour. A volume someone chose
  // by hand keeps what they chose — the standing preference is the rule
  // underneath, not a bulk overwrite of decisions already made.
  revalidatePath(`/subjects/${subjectId}`);
}

// -------------------------------------------------------------- membership

/**
 * Where a family's membership actions live.
 *
 * Cancelling is one click and needs no reason. There is no "are you sure",
 * no offer, no survey and no retention flow — a product whose whole claim is
 * that a family's memories are theirs cannot make leaving harder than
 * joining, and the pricing page already promises everything stays readable.
 */
async function ownedFamily(db: Awaited<ReturnType<typeof userClient>>, familyId: string, userId: string) {
  const role = await roleInFamily(db, familyId, userId);
  if (!canManageAccess(role)) throw new Error("only the owner can change the plan");
  const { data: family } = await db
    .from("families")
    .select("id, plan, membership_state, stripe_subscription_id, paid_until, months_paid_this_year")
    .eq("id", familyId)
    .single();
  if (!family) throw new Error("family not found");
  return family;
}

export async function cancelMembership(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const familyId = String(formData.get("family_id"));
  const family = await ownedFamily(db, familyId, user.id);

  if (!family.stripe_subscription_id) {
    redirect("/settings/billing?error=There%20is%20no%20membership%20to%20stop.");
  }

  // At the end of the period they have already paid for, not immediately.
  // Taking away the month they just bought is both mean and a refund request.
  await endMembership(family.stripe_subscription_id);

  await adminClient().from("billing_events").insert({
    family_id: familyId,
    kind: "cancel_requested",
    plan: family.plan,
    state: family.membership_state,
    note: "asked to stop at the end of the paid period",
  });
  void note(adminClient(), user.id, { name: "stopped_paying" });

  revalidatePath("/settings/billing");
  redirect("/settings/billing?stopped=1");
}

export async function resumeMembershipAction(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const familyId = String(formData.get("family_id"));
  const family = await ownedFamily(db, familyId, user.id);

  if (!family.stripe_subscription_id) {
    redirect("/settings/billing?error=There%20is%20no%20membership%20to%20restart.");
  }

  await resumeMembership(family.stripe_subscription_id);

  await adminClient().from("billing_events").insert({
    family_id: familyId,
    kind: "cancel_withdrawn",
    plan: family.plan,
    state: family.membership_state,
    note: "changed their mind before it ended",
  });

  revalidatePath("/settings/billing");
  redirect("/settings/billing?resumed=1");
}

/** Start a membership from inside the product, for a one-off family. */
export async function startMembership(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const familyId = String(formData.get("family_id"));
  await ownedFamily(db, familyId, user.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await createMembershipCheckout({
    familyId,
    email: user.email!,
    successUrl: `${appUrl}/settings/billing?started=1`,
    cancelUrl: `${appUrl}/settings/billing`,
  });
  redirect(session.url!);
}

// ---------------------------------------------------------------- noticing

/**
 * What a family says about something we noticed.
 *
 * Three answers and they mean different things. "Keep" says this thread
 * matters and should reach the book. "Tell me more" turns an observation
 * into a question, which is the whole notice → ask → remember loop running
 * in one tap. "Ignore" says we were wrong, and it is permanent — being told
 * so and saying the same thing next month is worse than never asking.
 */
export async function answerNoticed(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const noticedId = String(formData.get("noticed_id"));
  const subjectId = String(formData.get("subject_id"));
  const verdict = String(formData.get("verdict"));

  if (!["kept", "more", "ignored"].includes(verdict)) return;

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change what this archive keeps");
  }

  const { data: row } = await db
    .from("noticed")
    .select("entity_id, line")
    .eq("id", noticedId)
    .single();

  await db
    .from("noticed")
    .update({ verdict, answered_at: new Date().toISOString() })
    .eq("id", noticedId);

  // "Tell me more" becomes a real question in the queue, carrying the
  // observation as its reason — so the answer, when it comes, is a memory
  // that knows what prompted it.
  if (verdict === "more" && row) {
    await db.from("follow_up_questions").insert({
      subject_id: subjectId,
      question: `${row.line} Anything you want to say about that?`,
      reason: "You asked to hear more about this.",
      status: "pending",
    });
  }

  revalidatePath(`/subjects/${subjectId}`);
}

// ------------------------------------------------------------- the inbox

/**
 * Answer the one open question about an arrival, or decide not to.
 *
 * "Keep it undated" is offered as plainly as a date, and does the same
 * thing to the row: it clears the question. An archive that will not let
 * you say "I don't remember" is an archive that collects wrong answers,
 * and a wrong date is worse than none — it moves a memory into the wrong
 * year and the wrong book, where nothing downstream can tell it was a guess.
 */
export async function fileArrivalAction(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const memoryId = String(formData.get("memory_id"));
  const subjectId = String(formData.get("subject_id"));
  // Which button was pressed, not merely what is in the field. Someone who
  // types a date, thinks better of it and presses "I don't know" has said
  // they don't know, and reading the field anyway would record a date they
  // just withdrew.
  const saidUnknown = String(formData.get("intent") ?? "") === "unknown";
  const date = saidUnknown ? "" : String(formData.get("memory_date") ?? "").trim();

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this archive");
  }

  // Constrained by the archive rather than by the subject. A memory no
  // longer belongs to one child, so the old `.eq("subject_id", …)` here
  // matched nothing and filing an arrival silently did nothing at all.
  const story = await storySubject(db, subjectId);
  if (!story) throw new Error("no such subject");

  await db
    .from("memories")
    .update({
      filed_at: new Date().toISOString(),
      ...(date ? { memory_date: date } : {}),
    })
    .eq("id", memoryId)
    .eq("family_id", story.family_id);

  revalidatePath(`/subjects/${subjectId}/inbox`);
}

/**
 * Move an arrival to the child it was actually about.
 *
 * Only ever a correction of our own guess: a share sheet cannot ask whose
 * photograph it is, so a family with two children gets one. Checked on both
 * ends, because moving a memory between subjects is moving it between two
 * sets of permissions.
 */
export async function moveArrival(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const memoryId = String(formData.get("memory_id"));
  const fromSubject = String(formData.get("subject_id"));
  const toSubject = String(formData.get("to_subject_id"));

  for (const id of [fromSubject, toSubject]) {
    const membership = await roleForSubject(db, id, user.id);
    if (!membership || !canEdit(membership.role)) {
      throw new Error("not allowed to move this");
    }
  }

  // Re-tagging, not moving. The memory stays exactly where it was — in the
  // family's archive — and what changes is which story it belongs to. Under
  // the old model this was an UPDATE that carried the photograph out of one
  // child's year and into another's; now it is one link removed and one
  // added, and the household's year never notices.
  await db
    .from("memory_subjects")
    .delete()
    .eq("memory_id", memoryId)
    .eq("subject_id", fromSubject);

  await linkMemoryToSubjects(db, memoryId, [toSubject]);
  await db
    .from("memories")
    .update({ filed_at: new Date().toISOString() })
    .eq("id", memoryId);

  revalidatePath(`/subjects/${fromSubject}/inbox`);
  revalidatePath(`/subjects/${toSubject}/inbox`);
}

/**
 * Issue a new private address, retiring the old one immediately.
 *
 * Anything given out eventually ends up somewhere it should not be — a
 * forwarded thread, a screenshot in a group chat — and a write credential
 * you cannot change is one you can only hope about. Recorded in the activity
 * log, because a rotation somebody did not perform is worth them seeing.
 */
export async function rotateInboxAddress(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this archive");
  }

  const { newToken } = await import("@/lib/inbox/address");
  await db
    .from("subject_inboxes")
    .upsert(
      { subject_id: subjectId, token: newToken(), rotated_at: new Date().toISOString() },
      { onConflict: "subject_id" }
    );

  const { data: subject } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", subjectId)
    .maybeSingle();

  await record(adminClient(), {
    familyId: subject?.family_id,
    subjectId,
    actorId: user.id,
    actorLabel: user.email ?? "a parent",
    kind: "inbox_address_rotated",
    detail: "The old address stopped working straight away.",
  });

  revalidatePath(`/subjects/${subjectId}/inbox`);
}

/** Whether mail from outside the family is reviewed or refused. */
export async function setInboxOpenness(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const open = formData.get("accept_from_anyone") === "on";

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this archive");
  }

  await db
    .from("subject_inboxes")
    .update({ accept_from_anyone: open })
    .eq("subject_id", subjectId);

  revalidatePath(`/subjects/${subjectId}/inbox`);
}

// ------------------------------------------------------------- who is in it

/**
 * Add or remove one person from one memory.
 *
 * A toggle with no save button, because tagging is dozens of small decisions
 * and anything that asks for confirmation on each is something people do six
 * times and abandon.
 */
export async function toggleWhoAction(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const memoryId = String(formData.get("memory_id"));
  const subjectId = String(formData.get("subject_id"));
  const key = String(formData.get("who"));

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this archive");
  }

  await toggleWho(db, memoryId, key);
  revalidatePath(`/subjects/${subjectId}/years`);
  revalidatePath(`/subjects/${subjectId}/tag`);
}

/**
 * Say who is in a batch of photographs at once.
 *
 * The one that matters after a backfill. Somebody who has just emptied a
 * year in has two hundred photographs and no patience, and the difference
 * between "tap forty times" and "select forty, tap twice" is the difference
 * between an archive that can produce a second book and one that cannot.
 *
 * Adds only. Removing in bulk is a way to undo an afternoon's work with one
 * mis-tap, and the single toggle is right there for corrections.
 */
export async function tagManyAction(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const keys = formData.getAll("who").map(String).filter(Boolean);
  const memoryIds = formData.getAll("memory_id").map(String).filter(Boolean);

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to change this archive");
  }
  if (keys.length === 0 || memoryIds.length === 0) {
    redirect(`/subjects/${subjectId}/tag`);
  }

  const subjectKeys = keys.map(parseKey).filter((w) => w?.kind === "subject");
  const memberKeys = keys.map(parseKey).filter((w) => w?.kind === "member");

  // Upserted rather than inserted so re-tagging a photograph that was already
  // tagged is a no-op instead of an error that loses the whole batch.
  if (subjectKeys.length > 0) {
    await db.from("memory_subjects").upsert(
      memoryIds.flatMap((memory_id) =>
        subjectKeys.map((w) => ({ memory_id, subject_id: w!.id }))
      ),
      { onConflict: "memory_id,subject_id" }
    );
  }
  if (memberKeys.length > 0) {
    await db.from("memory_people").upsert(
      memoryIds.flatMap((memory_id) =>
        memberKeys.map((w) => ({ memory_id, family_member_id: w!.id }))
      ),
      { onConflict: "memory_id,family_member_id" }
    );
  }

  // The graph reads people and subjects, so a tagging pass genuinely changes
  // what the product can notice. Batched by the hour like every other path.
  const window = Math.floor(Date.now() / (60 * 60 * 1000));
  await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);

  redirect(`/subjects/${subjectId}/tag`);
}

// ------------------------------------------------------------ the stories

/**
 * Open a book for a story the family chose.
 *
 * Replaces the child-shaped createBook path for everything that is not a
 * child: the period, the title and the year number all come from periodFor(),
 * which is the one place that knows a household's year runs January to
 * December and a child's runs birthday to birthday.
 */
export async function startStory(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const calendarYear = Number(formData.get("calendar_year")) || null;

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to make a book for this family");
  }

  const { data: subject } = await db
    .from("subjects")
    .select("display_name, subject_type, date_of_birth")
    .eq("id", subjectId)
    .single();
  if (!subject) throw new Error("no such subject");

  const period = periodFor(subject as any, { calendarYear });

  // Keyed on the period rather than on the year number, because a household's
  // year_number is null and two family annuals would collide on it.
  const { data: existing } = await db
    .from("books")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("start_date", period.start)
    .maybeSingle();
  if (existing) redirect(`/books/${existing.id}`);

  const { data: book, error } = await db
    .from("books")
    .insert({
      subject_id: subjectId,
      year_number: period.yearNumber,
      title: period.title,
      start_date: period.start,
      end_date: period.end,
      status: "collecting",
    })
    .select("id")
    .single();
  if (error || !book) throw new Error(error?.message ?? "could not start that book");

  await enqueue(adminClient(), "generate_book", { book_id: book.id }, `generate-${book.id}`);
  redirect(`/books/${book.id}`);
}

/**
 * Create the household as a subject, the first time somebody asks for a
 * family annual.
 *
 * Not made at signup. A subject that exists before anybody wants it shows up
 * in every list, every picker and every count as a book nobody asked for —
 * and a family with one child would spend a year looking at an empty second
 * volume beside a full one.
 */
export async function startHousehold(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const familyId = String(formData.get("family_id"));

  const role = await roleInFamily(db, familyId, user.id);
  if (!role || !canEdit(role)) throw new Error("not allowed to change this family");

  const { data: existing } = await db
    .from("subjects")
    .select("id")
    .eq("family_id", familyId)
    .eq("subject_type", "family")
    .maybeSingle();
  if (existing) redirect(`/books/new?story=${existing.id}`);

  const { data: family } = await db
    .from("families")
    .select("family_name")
    .eq("id", familyId)
    .maybeSingle();

  const { data: subject, error } = await db
    .from("subjects")
    .insert({
      family_id: familyId,
      subject_type: "family",
      // Their own name for themselves when they gave one. "Our family" is a
      // poor cover, but a wrong surname printed on a hardcover is worse.
      display_name: family?.family_name?.trim() || "Our family",
      date_of_birth: null,
    })
    .select("id")
    .single();
  if (error || !subject) throw new Error(error?.message ?? "could not start that");

  redirect(`/books/new?story=${subject.id}`);
}

// ------------------------------------------------------- who's who

/**
 * Record whether two names are one person.
 *
 * The whole of the answer's meaning is in identity-store.recordAnswer, which
 * writes the resolution and builds the entity together — this is the form
 * boundary and nothing else. A "no" is stored as carefully as a "yes",
 * because the point of asking is that the question then goes away for good.
 */
export async function resolveIdentity(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const familyId = String(formData.get("family_id"));
  const same = String(formData.get("answer")) === "same";

  // Two ways in. The question posts the pair it asked about; the picker
  // posts two entity ids the family chose, with the labels read back from
  // the graph rather than trusted from the form — a label arriving from a
  // browser is a label anybody can type.
  const pickedA = String(formData.get("pick_a") ?? "");
  const pickedB = String(formData.get("pick_b") ?? "");
  if (pickedA && pickedB) {
    if (pickedA === pickedB) {
      revalidatePath(`/subjects/${subjectId}/who`);
      return;
    }
    const chosen = await loadEntities(db, subjectId);
    const a = chosen.find((e) => e.id === pickedA);
    const b = chosen.find((e) => e.id === pickedB);
    if (!a || !b || a.kind !== b.kind) {
      revalidatePath(`/subjects/${subjectId}/who`);
      return;
    }
    await recordAnswer(db, {
      familyId,
      keyA: a.id,
      keyB: b.id,
      labelA: a.label,
      labelB: b.label,
      kind: a.kind,
      same: true,
      keep: a.mentions.length >= b.mentions.length ? a.label : b.label,
      decidedBy: user.id,
    });
    revalidatePath(`/subjects/${subjectId}/who`);
    revalidatePath(`/subjects/${subjectId}/noticed`);
    return;
  }

  await recordAnswer(db, {
    familyId,
    keyA: String(formData.get("key_a")),
    keyB: String(formData.get("key_b")),
    labelA: String(formData.get("label_a")),
    labelB: String(formData.get("label_b")),
    kind: String(formData.get("kind")),
    same,
    // Which name to keep. Defaults to the one they use more, which is what
    // the page offers first — but it is their choice, not a majority vote.
    keep: same ? String(formData.get("keep") ?? formData.get("label_a")) : undefined,
    decidedBy: user.id,
  });

  revalidatePath(`/subjects/${subjectId}/who`);
  revalidatePath(`/subjects/${subjectId}/noticed`);
}

/**
 * Start a book about one person and the child.
 *
 * Nanna & Me: the first book that is not a year. It is the child's book —
 * subject_id is theirs, and the cover addresses them — with no year number,
 * because it is not one. Keyed on the title so a second attempt opens the
 * one that exists rather than making a duplicate; the period is a span
 * rather than a book year, so start_date is not the unique thing it is for
 * an annual volume.
 */
export async function startPersonBook(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const entityId = String(formData.get("entity_id"));

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) {
    throw new Error("not allowed to make a book for this family");
  }

  // Recomputed here rather than trusted from the form. The title, the dates
  // and whether it is ready at all are decisions this product makes, and a
  // form is a place anybody can type.
  const stories = await peopleBooksFor(db, subjectId);
  const story = stories.find((s) => s.entityId === entityId);
  if (!story) throw new Error("no such person in this archive");
  if (!story.ready) throw new Error(story.notYet ?? "not ready yet");

  const { data: existing } = await db
    .from("books")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("title", story.title)
    .maybeSingle();
  if (existing) redirect(`/books/${existing.id}`);

  const { data: book, error } = await db
    .from("books")
    .insert({
      subject_id: subjectId,
      year_number: null,
      title: story.title,
      subtitle: story.subtitle,
      start_date: story.firstDate,
      end_date: story.lastDate,
      status: "collecting",
    })
    .select("id")
    .single();
  if (error || !book) throw new Error(error?.message ?? "could not start the book");

  revalidatePath("/books/new");
  redirect(`/books/${book.id}`);
}


/**
 * Whether a batch of files would fit, asked before any of them are uploaded.
 *
 * One round trip for a whole camera roll rather than one per file. The
 * per-file check in registerUploadedPhoto is still the authoritative one —
 * this exists so a family is told before three hundred files are pushed into
 * a bucket, not after.
 */
export async function roomForBatch(subjectId: string, bytes: number, count = 1) {
  const user = await requireUser();
  const db = await userClient();
  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");
  const story = await storySubject(db, subjectId);
  if (!story) throw new Error("no such subject");

  // Which wall, as well as whether. They need different sentences and
  // different buttons: running out of space is something you can buy more
  // of, and reaching the free cap is a question about the plan. Sending a
  // family on the free tier to "add more space" would be sending them to
  // buy the wrong thing.
  const room = await roomToAdd(db, story.family_id, bytes);
  if (!room.ok) return { ok: false, why: "space" as const, message: room.message };

  // How many of this batch fit under the free cap. Reported before three
  // hundred files are pushed at a bucket, for the same reason the byte
  // check is: being told after is the same as not being told.
  const kept = await mayKeepMore(db, story.family_id, count);
  return {
    ok: kept.ok,
    why: "plan" as const,
    message: kept.message ?? room.message,
  };
}


// ----------------------------------------------------------- succession
//
// Naming somebody, and the two ways a claim ends. The rules are in
// lib/succession/policy.ts and the sweep is in lib/succession/run.ts; these
// are the four things a person can do about it from a browser.

/** The family this user owns, or an error naming why not. */
async function ownedFamilyId(db: Awaited<ReturnType<typeof userClient>>, userId: string) {
  const { data } = await db
    .from("families")
    .select("id, family_name")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("only the owner of an archive can change who keeps it");
  return data as { id: string; family_name: string | null };
}

/**
 * Name the person who would take the archive over.
 *
 * The owner is emailed immediately, and that email is the security control
 * rather than a courtesy: somebody who gets into an account and names
 * themselves has to also stop the real owner reading their mail.
 */
export async function nameKeeper(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const family = await ownedFamilyId(db, user.id);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const relationship = String(formData.get("relationship") ?? "").trim() || null;
  if (!email.includes("@")) {
    redirect("/settings/succession?error=" + encodeURIComponent("That doesn't look like an email address."));
  }
  if (email === (user.email ?? "").toLowerCase()) {
    redirect("/settings/succession?error=" + encodeURIComponent("A keeper has to be somebody else."));
  }

  const { error } = await db
    .from("family_keepers")
    .upsert(
      { family_id: family.id, email, relationship, named_by: user.id, declined_at: null },
      { onConflict: "family_id,email" }
    );
  if (error) throw new Error(error.message);

  await record(adminClient(), {
    familyId: family.id,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "The owner",
    kind: "named_keeper",
    detail: `named ${email}`,
  });

  if (user.email) {
    await sendOnce(adminClient(), {
      kind: "keeper_named",
      message: keeperNamedEmail({
        to: { email: user.email },
        keeperEmail: email,
        settlingDays: SETTLING_DAYS,
      }),
      // Keyed on the pair, so re-naming the same person does not send again
      // but naming somebody new always does.
      dedupeKey: `keeper-named-${family.id}-${email}`,
      userId: user.id,
    });
  }

  revalidatePath("/settings/succession");
  redirect("/settings/succession?named=1");
}

/** Change your mind about who keeps it. */
export async function removeKeeper(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const family = await ownedFamilyId(db, user.id);
  const keeperId = String(formData.get("keeper_id"));

  const { data: keeper } = await db
    .from("family_keepers")
    .select("email")
    .eq("id", keeperId)
    .maybeSingle();

  await db.from("family_keepers").delete().eq("id", keeperId).eq("family_id", family.id);

  await record(adminClient(), {
    familyId: family.id,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "The owner",
    kind: "removed_keeper",
    detail: keeper ? `removed ${(keeper as any).email}` : "removed a keeper",
  });

  revalidatePath("/settings/succession");
  redirect("/settings/succession?removed=1");
}

/**
 * A keeper says the owner has died.
 *
 * Nothing happens today. This opens the notice period, and the whole of the
 * next month is spent trying to be told otherwise.
 */
export async function claimArchive(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const familyId = String(formData.get("family_id"));
  const email = (user.email ?? "").toLowerCase();

  // Read through the keeper's own row, which RLS only shows them if they
  // are actually named on this family.
  const { data: keeper } = await db
    .from("family_keepers")
    .select("id, named_at, declined_at, family_id")
    .eq("family_id", familyId)
    .ilike("email", email)
    .maybeSingle();
  if (!keeper) throw new Error("you are not named as this archive's keeper");

  const admin = adminClient();
  const { count } = await admin
    .from("succession_claims")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("status", "notice");

  const allowed = mayClaim(
    { namedAt: (keeper as any).named_at, declinedAt: (keeper as any).declined_at },
    count ?? 0,
    new Date().toISOString()
  );
  if (!allowed.ok) {
    redirect("/settings/succession?error=" + encodeURIComponent(allowed.because));
  }

  await openClaim(admin, {
    familyId,
    keeperId: (keeper as any).id,
    keeperEmail: email,
    opening: "claimed",
  });

  revalidatePath("/settings/succession");
  redirect("/settings/succession?asked=1");
}

/**
 * The owner says no.
 *
 * Signing in already does this on the next sweep — this is the button for
 * somebody who wants it stopped now, and who deserves to be told who asked.
 */
export async function refuseClaim(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const family = await ownedFamilyId(db, user.id);
  const claimId = String(formData.get("claim_id"));

  const admin = adminClient();
  const { data: claim } = await admin
    .from("succession_claims")
    .select("id, keeper_email")
    .eq("id", claimId)
    .eq("family_id", family.id)
    .eq("status", "notice")
    .maybeSingle();
  if (!claim) redirect("/settings/succession");

  await admin
    .from("succession_claims")
    .update({
      status: "refused",
      settled_at: new Date().toISOString(),
      settled_because: "the owner stopped it",
    })
    .eq("id", claimId)
    .eq("status", "notice");

  await record(admin, {
    familyId: family.id,
    actorId: user.id,
    actorLabel: (claim as any).keeper_email,
    kind: "succession_refused",
    detail: "asked to take over the archive; the owner stopped it",
  });

  revalidatePath("/settings/succession");
  redirect("/settings/succession?stopped=1");
}


/**
 * What the family said about a thing.
 *
 * The most valuable write in the product. Everything else here can be
 * reconstructed from photographs; this cannot be reconstructed from
 * anything, because it only exists in somebody's head and it is going.
 *
 * The `because` is stored alongside the answer on purpose. "It just stopped"
 * is uninterpretable in five years without the sentence it was answering.
 */
export async function answerAboutThing(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const familyId = String(formData.get("family_id"));
  const entityKey = String(formData.get("entity_key"));
  const wondering = String(formData.get("wondering")) as Wondering;
  const because = String(formData.get("because") ?? "") || null;

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");

  // A skip is a real answer and is stored as one. Re-asking something
  // somebody declined is worse than never asking.
  const skipped = String(formData.get("intent")) === "skip";
  const answer = skipped ? null : String(formData.get("answer") ?? "").trim();

  // An empty box submitted with "Keep this" is a slip, not a decline —
  // silencing the question on it would be the wrong reading of a blank.
  if (!skipped && !answer) {
    revalidatePath(`/subjects/${subjectId}/about`);
    return;
  }

  await recordContext(db, {
    familyId,
    entityKey,
    wondering,
    answer: skipped ? null : answer,
    because,
    userId: user.id,
  });

  revalidatePath(`/subjects/${subjectId}/about`);
  revalidatePath(`/subjects/${subjectId}`);
}


/**
 * What was happening that day.
 *
 * The first thing most families will ever type into Qotidia, answered
 * against a day the product found in their camera roll rather than against
 * a blank box.
 *
 * It becomes an ordinary memory, dated to that day. No new table, and more
 * importantly no separate holding pen for onboarding answers: the first
 * sentence somebody writes is archive content immediately, goes into the
 * book, and is the title of the story on the way out.
 */
export async function answerDiscovery(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const day = String(formData.get("day"));
  const said = String(formData.get("answer") ?? "").trim();

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) throw new Error("not a member of this family");
  const story = await storySubject(db, subjectId);
  if (!story) throw new Error("no such subject");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad day");
  if (!said) redirect(`/subjects/${subjectId}/found`);

  await keepMemory(db, {
    familyId: story.family_id,
    about: [subjectId],
    memory: {
      created_by: user.id,
      type: "text",
      raw_text: said,
      memory_date: day,
      filed_at: new Date().toISOString(),
      // Approved on arrival: the person who owns the archive wrote it. The
      // moderation queue exists for contributions from other people.
      contribution_status: canModerate(membership.role) ? "approved" : "pending",
      visibility: "family",
    },
  });

  revalidatePath(`/subjects/${subjectId}/found`);
  redirect(`/subjects/${subjectId}/found`);
}


// -------------------------------------------------------------- sharing
//
// Sending one story to one person. Why this is not the "public share link"
// the original brief refused is argued in lib/share/policy.ts.

/**
 * Freeze a story and mint a link for it.
 *
 * The payload is written now, not resolved on open. What a grandmother sees
 * next week has to be what was sent this week, and the archive underneath
 * changes constantly.
 */
export async function shareStory(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const subjectId = String(formData.get("subject_id"));
  const kind = String(formData.get("kind"));
  if (kind !== "found" && kind !== "film") throw new Error("nothing to share");

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) throw new Error("not yours to share");
  const story = await storySubject(db, subjectId);
  if (!story) throw new Error("no such subject");

  // Whatever the page was showing, passed through rather than recomputed —
  // the two must not be able to disagree.
  const payload = JSON.parse(String(formData.get("payload") ?? "null"));
  if (!payload?.title || !Array.isArray(payload?.shotIds) || payload.shotIds.length === 0) {
    throw new Error("there is nothing to send yet");
  }

  const now = new Date().toISOString();
  const admin = adminClient();
  const token = newToken();
  const { error } = await admin.from("shared_stories").insert({
    family_id: story.family_id,
    subject_id: subjectId,
    token,
    kind,
    payload,
    shared_by: user.id,
    expires_at: expiresAtFrom(now),
    // Written out rather than left to the column default. Anything that
    // reads the row back — including the page that renders the link — needs
    // the value to be *in* it, and a default only exists in the database.
    allow_contributions: true,
  });
  if (error) throw new Error(error.message);

  await record(admin, {
    familyId: story.family_id,
    subjectId,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "Someone",
    kind: "shared_story",
    // The title, never the contents. It is going in a log the whole family
    // reads.
    detail: `shared “${String(payload.title).slice(0, 60)}”`,
  });
  void note(db, user.id, { name: "story_shared" });

  revalidatePath(`/subjects/${subjectId}/found`);
  redirect(`/subjects/${subjectId}/found?shared=${token}`);
}

/** Pull a link back. Everything it reached stays exactly where it is. */
export async function revokeShare(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const shareId = String(formData.get("share_id"));
  const subjectId = String(formData.get("subject_id"));

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canEdit(membership.role)) throw new Error("not yours to revoke");

  const admin = adminClient();
  const { data: share } = await admin
    .from("shared_stories")
    .select("id, family_id, payload")
    .eq("id", shareId)
    .maybeSingle();
  if (!share) redirect(`/subjects/${subjectId}/found`);

  await admin
    .from("shared_stories")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .is("revoked_at", null);

  await record(admin, {
    familyId: (share as any).family_id,
    subjectId,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "Someone",
    kind: "revoked_share",
    detail: "stopped a link that had been sent",
  });

  revalidatePath(`/subjects/${subjectId}/found`);
  redirect(`/subjects/${subjectId}/found`);
}

/**
 * Somebody with no account says what they remember.
 *
 * The only write in the product that happens without a session. Every check
 * that matters — is the link live, has it had too many, is the text within
 * length — happens here, because none of them is expressible as a policy
 * and the table refuses direct writes outright.
 */
export async function contributeToStory(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!TOKEN_SHAPE.test(token)) throw new Error("no such link");

  const admin = adminClient();
  const { data: rows } = await admin.rpc("open_shared_story", { t: token });
  const share = Array.isArray(rows) ? rows[0] : null;

  const state = reachable(
    share
      ? {
          expiresAt: share.expires_at,
          revokedAt: share.revoked_at,
          allowContributions: share.allow_contributions,
          contributionCount: share.contribution_count ?? 0,
        }
      : null,
    new Date().toISOString()
  );
  if (!state.ok || !state.mayContribute) {
    redirect(`/m/${token}?full=1`);
  }

  const checked = accept(
    { name: String(formData.get("name") ?? ""), body: String(formData.get("body") ?? "") },
    share.contribution_count ?? 0
  );
  if (!checked.ok) {
    redirect(`/m/${token}?error=${encodeURIComponent(checked.because)}`);
  }

  await admin.from("story_contributions").insert({
    share_id: share.id,
    family_id: share.family_id,
    said_by: checked.name,
    body: checked.body,
    email: String(formData.get("email") ?? "").trim() || null,
    // Explicit, like allow_contributions above. Twice in this one feature a
    // value was left to a column default and then filtered on — and a row
    // whose status only exists in the database is a row the code that just
    // wrote it cannot find.
    status: "pending",
  });

  await record(admin, {
    familyId: share.family_id,
    subjectId: share.subject_id ?? null,
    actorId: null,
    actorLabel: checked.name,
    kind: "story_contribution",
    // The name, never what they wrote. The family reads the words
    // themselves, in the place where they can keep or decline them.
    detail: "added something to a story they were sent",
  });

  // Attributed to whoever *sent* the story, not to the person replying —
  // who has no account, and whom we are not going to give a pseudonym to
  // for the privilege of doing a family a favour. The funnel step being
  // measured is "the story I shared came back with something in it", and
  // that belongs to the sharer.
  if (share.shared_by) {
    void note(admin, String(share.shared_by), { name: "contribution_received" });
  }

  redirect(`/m/${token}?thanks=1`);
}

/** The family keeps what came back, or does not. */
export async function judgeContribution(formData: FormData) {
  const user = await requireUser();
  const db = await userClient();
  const contributionId = String(formData.get("contribution_id"));
  const subjectId = String(formData.get("subject_id"));
  const keep = String(formData.get("verdict")) === "keep";

  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership || !canModerate(membership.role)) throw new Error("not yours to decide");

  const admin = adminClient();
  const { data: contribution } = await admin
    .from("story_contributions")
    .select("id, family_id, said_by, body, status")
    .eq("id", contributionId)
    .maybeSingle();
  if (!contribution || (contribution as any).status !== "pending") {
    redirect(`/subjects/${subjectId}/review`);
  }

  let memoryId: string | null = null;
  if (keep) {
    // Becomes an ordinary memory, with the name of whoever remembered it
    // kept alongside their words. They have no account, so there is no
    // created_by to point at them — the sentence carries the attribution.
    memoryId = await keepMemory(admin, {
      familyId: (contribution as any).family_id,
      about: [subjectId],
      memory: {
        created_by: user.id,
        type: "text",
        raw_text: (contribution as any).body,
        contributed_by_name: (contribution as any).said_by,
        memory_date: null,
        contribution_status: "approved",
        visibility: "family",
      },
    });
  }

  await admin
    .from("story_contributions")
    .update({ status: keep ? "kept" : "declined", memory_id: memoryId })
    .eq("id", contributionId)
    .eq("status", "pending");

  revalidatePath(`/subjects/${subjectId}/review`);
  redirect(`/subjects/${subjectId}/review`);
}
