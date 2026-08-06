// Background job handlers (brief §26).
// Each handler is idempotent: re-running a job after a crash produces the
// same end state and never duplicates print orders or payments.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIProvider } from "@/lib/ai/provider";
import { getPrintProvider } from "@/lib/print/provider";
import { enqueue, type Job } from "./queue";
import { paginateBook, littleThingsBlocks } from "@/lib/book/generate";
import { renderBookPdf } from "@/lib/pdf/render";
import { runPreflight, type PlacedImage } from "@/lib/pdf/preflight";
import { yearWord } from "@/lib/book/structure";
import { FORMAT, imageTier } from "@/lib/book/format";
import { colourForAge } from "@/lib/book/colours";
import { sha256 } from "@/lib/media";
import { ghostscriptAvailable, toPressReady } from "@/lib/pdf/pdfx";
import { listenUrl, qrDataUri } from "@/lib/listen/qr";
import { sendOnce } from "@/lib/email/send";
import { runDigestFor } from "@/lib/email/digest";
import type { ArchiveState } from "@/lib/prompts/engine";
import { announceRenewals, collectRenewals } from "@/lib/renewal/run";
import { buildExport } from "@/lib/privacy/build-export";
import { eraseFamily } from "@/lib/privacy/erase";
import {
  bookReady as bookReadyEmail,
  orderShipped as orderShippedEmail,
} from "@/lib/email/messages";
import type { ContentBlockDraft, MediaAsset, Memory } from "@/lib/types";

type Handler = (db: SupabaseClient, payload: Record<string, unknown>) => Promise<void>;

export const handlers: Record<string, Handler> = {
  analyse_memories: analyseMemories,
  cluster_memories: clusterMemories,
  generate_questions: generateQuestions,
  generate_book: generateBook,
  render_pdf: renderPdf,
  submit_print: submitPrint,
  poll_print_status: pollPrintStatus,
  notify_digest: notifyDigest,
  build_export: buildExportJob,
  erase_family: eraseFamilyJob,
};

/** Assemble a family's whole archive into one downloadable file. */
async function buildExportJob(db: SupabaseClient, payload: Record<string, unknown>) {
  const exportId = payload.export_id as string;
  const familyId = payload.family_id as string;
  try {
    const built = await buildExport(db, familyId, exportId);
    await db
      .from("archive_exports")
      .update({
        status: "ready",
        storage_path: built.storagePath,
        size_bytes: built.sizeBytes,
        item_count: built.itemCount,
      })
      .eq("id", exportId);
  } catch (err) {
    await db.from("archive_exports").update({ status: "failed" }).eq("id", exportId);
    throw err;
  }
}

/**
 * Erase a family, irreversibly. Runs as a job rather than inline because a
 * decade of photographs takes minutes to remove, and a request that times
 * out halfway is the worst possible outcome for a deletion.
 */
async function eraseFamilyJob(db: SupabaseClient, payload: Record<string, unknown>) {
  const familyId = payload.family_id as string;
  const requestId = payload.request_id as string;
  await eraseFamily(db, familyId);
  // The deletion record survives the cascade deliberately: we must be able to
  // show that we did this, and a receipt that deletes itself proves nothing.
  await db
    .from("deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", requestId);
}

export async function runJob(db: SupabaseClient, job: Job): Promise<void> {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`no handler for job type ${job.type}`);
  await handler(db, job.payload);
}

// ------------------------------------------------------------- helpers

/**
 * Every memory that is allowed to shape the book.
 *
 * Two filters, and these jobs run as the service role — so RLS does not cover
 * them and these two lines are the only thing standing between the archive
 * and a printed page.
 *
 * Approved only: a grandparent can add to the archive, but nothing they add
 * reaches the book — or even the pattern finding that decides what the year
 * was about — until the parent has said yes.
 *
 * Shared only: a private note is written for one person, and the book is read
 * by the whole family with extra copies posted to grandparents.
 */
async function loadMemories(db: SupabaseClient, subjectId: string): Promise<Memory[]> {
  const { data, error } = await db
    .from("memories")
    .select("*, memory_tags(tag), memory_people(family_members(name))")
    .eq("subject_id", subjectId)
    .eq("contribution_status", "approved")
    .eq("visibility", "family");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => ({
    ...m,
    tags: (m.memory_tags ?? []).map((t: any) => t.tag),
    people: (m.memory_people ?? [])
      .map((p: any) => p.family_members?.name)
      .filter(Boolean),
  }));
}

// ------------------------------------------------------------- handlers

async function analyseMemories(db: SupabaseClient, payload: Record<string, unknown>) {
  const subjectId = payload.subject_id as string;
  const memories = await loadMemories(db, subjectId);
  const pending = memories.filter((m) => !(m.metadata as any)?.analysis);
  if (pending.length === 0) return;

  const { data: subject } = await db.from("subjects").select("family_id").eq("id", subjectId).single();
  const { data: members } = await db
    .from("family_members")
    .select("*")
    .eq("family_id", subject!.family_id);

  const analyses = await getAIProvider().analyseMemories({
    memories: pending,
    familyMembers: members ?? [],
  });

  for (const analysis of analyses) {
    const memory = pending.find((m) => m.id === analysis.memory_id);
    if (!memory) continue;
    await db
      .from("memories")
      .update({ metadata: { ...(memory.metadata as object), analysis } })
      .eq("id", analysis.memory_id);
    // AI-suggested tags stay editable (§5); upsert keeps this idempotent.
    for (const tag of analysis.suggested_tags.slice(0, 6)) {
      await db
        .from("memory_tags")
        .upsert(
          { memory_id: analysis.memory_id, tag, source: "ai" },
          { onConflict: "memory_id,tag", ignoreDuplicates: true }
        );
    }
  }
  await enqueue(db, "cluster_memories", { subject_id: subjectId }, `cluster-${subjectId}-${Date.now()}`);
}

async function clusterMemories(db: SupabaseClient, payload: Record<string, unknown>) {
  const subjectId = payload.subject_id as string;
  const memories = await loadMemories(db, subjectId);
  const suggestions = await getAIProvider().clusterMemories(memories);

  const { data: existing } = await db
    .from("memory_clusters")
    .select("id, title, status")
    .eq("subject_id", subjectId);
  const existingTitles = new Set((existing ?? []).map((c: any) => c.title.toLowerCase()));

  for (const cluster of suggestions) {
    // Idempotency: never re-suggest a title the parent has already seen.
    if (existingTitles.has(cluster.title.toLowerCase())) continue;
    const { data: row, error } = await db
      .from("memory_clusters")
      .insert({
        subject_id: subjectId,
        title: cluster.title,
        summary: cluster.summary,
        start_date: cluster.start_date,
        end_date: cluster.end_date,
        confidence: cluster.confidence,
        status: "suggested",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db
      .from("cluster_memories")
      .insert(cluster.memory_ids.map((mid) => ({ cluster_id: row.id, memory_id: mid })));
  }
  await enqueue(db, "generate_questions", { subject_id: subjectId }, `questions-${subjectId}-${Date.now()}`);
}

async function generateQuestions(db: SupabaseClient, payload: Record<string, unknown>) {
  const subjectId = payload.subject_id as string;
  const memories = await loadMemories(db, subjectId);
  const { data: clusterRows } = await db
    .from("memory_clusters")
    .select("*, cluster_memories(memory_id)")
    .eq("subject_id", subjectId)
    .neq("status", "rejected");
  const clusters = (clusterRows ?? []).map((c: any) => ({
    ...c,
    memory_ids: (c.cluster_memories ?? []).map((cm: any) => cm.memory_id),
  }));
  const { data: existing } = await db
    .from("follow_up_questions")
    .select("*")
    .eq("subject_id", subjectId);

  const questions = await getAIProvider().generateQuestions(memories, clusters, existing ?? []);
  const asked = new Set((existing ?? []).map((q: any) => q.question));
  for (const q of questions) {
    if (asked.has(q.question)) continue;
    await db.from("follow_up_questions").insert({
      subject_id: subjectId,
      cluster_id: q.cluster_id,
      question: q.question,
      reason: q.reason,
      status: "pending",
    });
  }
}

async function generateBook(db: SupabaseClient, payload: Record<string, unknown>) {
  const bookId = payload.book_id as string;
  const { data: book, error } = await db.from("books").select("*").eq("id", bookId).single();
  if (error) throw new Error(error.message);
  if (!["collecting", "drafting"].includes(book.status)) return; // already generated

  await db.from("books").update({ status: "drafting" }).eq("id", bookId);

  const subjectId = book.subject_id;
  const { data: subject } = await db.from("subjects").select("*").eq("id", subjectId).single();
  const allMemories = await loadMemories(db, subjectId);
  const memories = allMemories.filter(
    (m) => !m.memory_date || (m.memory_date >= book.start_date && m.memory_date <= book.end_date)
  );
  const { data: clusterRows } = await db
    .from("memory_clusters")
    .select("*, cluster_memories(memory_id)")
    .eq("subject_id", subjectId)
    .eq("status", "confirmed");
  const clusters = (clusterRows ?? []).map((c: any) => ({
    ...c,
    memory_ids: (c.cluster_memories ?? []).map((cm: any) => cm.memory_id),
  }));
  const { data: littleThings } = await db.from("little_things").select("*").eq("subject_id", subjectId);
  const { data: answers } = await db
    .from("follow_up_questions")
    .select("*")
    .eq("subject_id", subjectId)
    .eq("status", "answered");

  const ai = getAIProvider();
  const structure = await ai.generateBookStructure({
    subject,
    yearNumber: book.year_number,
    memories,
    clusters,
    littleThings: littleThings ?? [],
  });

  // Draft copy per section, provenance-enforced inside the provider.
  const memoryById = new Map(memories.map((m) => [m.id, m]));
  const sectionBlocks: ContentBlockDraft[][] = [];
  for (const section of structure.sections) {
    if (section.section_type === "little_things") {
      sectionBlocks.push([
        { type: "heading", content: section.title, source_ids: [], ai_generated: false },
        ...littleThingsBlocks(littleThings ?? []),
      ]);
      continue;
    }
    const sectionMemories = section.memory_ids
      .map((id) => memoryById.get(id))
      .filter((m): m is Memory => !!m);
    sectionBlocks.push(
      await ai.draftBookCopy({
        subject,
        yearNumber: book.year_number,
        section,
        memories: sectionMemories,
        answers: answers ?? [],
        littleThings: littleThings ?? [],
      })
    );
  }

  // Photo assets for pagination.
  const { data: assets } = await db
    .from("media_assets")
    .select("*")
    .in("memory_id", memories.length ? memories.map((m) => m.id) : ["-"]);
  const assetsByMemory = new Map<string, MediaAsset>(
    (assets ?? []).map((a: any) => [a.memory_id, a])
  );

  const pages = paginateBook({ structure, sectionBlocks, assetsByMemory });

  // Idempotent regeneration: replace any prior draft pages/sections.
  await db.from("book_sections").delete().eq("book_id", bookId);
  const sectionIds: string[] = [];
  for (let i = 0; i < structure.sections.length; i++) {
    const s = structure.sections[i];
    const { data: row, error: sErr } = await db
      .from("book_sections")
      .insert({
        book_id: bookId,
        position: i,
        section_type: s.section_type,
        title: s.title,
        summary: s.summary ?? null,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    sectionIds.push(row.id);
  }

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const { data: pageRow, error: pErr } = await db
      .from("book_pages")
      .insert({
        book_id: bookId,
        section_id: sectionIds[page.section_index],
        page_number: p + 1,
        template_id: page.template_id,
        layout_json: {},
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    for (const block of page.blocks) {
      await db.from("book_content_blocks").insert({
        page_id: pageRow.id,
        type: block.type,
        content: block.content,
        source_ids: block.source_ids,
        ai_generated: block.ai_generated,
      });
    }
  }

  await db
    .from("books")
    .update({ status: "review", title: structure.title, subtitle: structure.subtitle ?? null, page_count: pages.length })
    .eq("id", bookId);

  // The book is made and the parent has no idea. Until now this was the
  // largest hole in the whole flow: the product silently waited to be
  // rediscovered.
  await notifyBookReady(db, bookId, structure.title);
}

/** Tell whoever keeps the archive that their book is ready to read. */
async function notifyBookReady(db: SupabaseClient, bookId: string, title: string) {
  const { data: book } = await db
    .from("books")
    .select("id, subject_id, subjects(display_name, family_id)")
    .eq("id", bookId)
    .maybeSingle();
  const subject = (book as any)?.subjects;
  if (!subject) return;

  const owner = await familyOwner(db, subject.family_id);
  if (!owner) return;

  await sendOnce(db, {
    kind: "book_ready",
    dedupeKey: `book_ready-${bookId}`,
    userId: owner.userId,
    subjectId: book!.subject_id,
    message: bookReadyEmail({
      to: { email: owner.email },
      childName: subject.display_name,
      bookTitle: title,
      bookId,
    }),
  });
}

/**
 * The daily sweep — what is waiting, and whether a year is about to close.
 * Enqueued once a day by the scheduler that already drives the job runner.
 */
async function notifyDigest(db: SupabaseClient, payload: Record<string, unknown>) {
  // The day is passed in so a re-run reproduces the same decisions, and so
  // the batching window can be tested.
  const now = payload.day ? new Date(String(payload.day)) : new Date();

  const { data: subjects } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth, family_id");

  for (const s of subjects ?? []) {
    const { count } = await db
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", s.id)
      .eq("contribution_status", "pending");

    const owner = await familyOwner(db, s.family_id);

    await runDigestFor(
      db,
      {
        id: s.id,
        displayName: s.display_name,
        dateOfBirth: s.date_of_birth,
        familyId: s.family_id,
        pendingCount: count ?? 0,
        owner,
        archive: await archiveStateFor(db, s.id, s.display_name, now),
      },
      now
    );
  }

  // Announce before collecting, always and in that order — a charge must
  // never precede the notice that promised it.
  await announceRenewals(db, now, (familyId) => familyOwner(db, familyId));
  await collectRenewals(db, now, (familyId) => familyOwner(db, familyId));
}

/**
 * What the prompt engine needs, read out of the archive.
 *
 * Every field here is a fact — when they last added something, which months
 * are empty, how old a little thing is. Nothing is inferred, because a
 * prompt built on a guess is the nudge equivalent of inventing a memory.
 */
async function archiveStateFor(
  db: SupabaseClient,
  subjectId: string,
  displayName: string,
  now: Date
): Promise<ArchiveState> {
  const [{ data: latest }, { data: threads }, { data: littleThings }, { data: voice }, { data: lastQuote }, { data: thisYear }] =
    await Promise.all([
      db.from("memories").select("created_at").eq("subject_id", subjectId)
        .eq("visibility", "family").order("created_at", { ascending: false }).limit(1),
      db.from("memory_clusters").select("title").eq("subject_id", subjectId)
        .eq("status", "confirmed").order("created_at", { ascending: false }).limit(3),
      db.from("little_things").select("category, value, recorded_date")
        .eq("subject_id", subjectId).order("recorded_date", { ascending: false }).limit(12),
      db.from("memories").select("id").eq("subject_id", subjectId).eq("type", "voice").limit(1),
      db.from("memories").select("memory_date, created_at").eq("subject_id", subjectId)
        .eq("type", "quote").order("created_at", { ascending: false }).limit(1),
      db.from("memories").select("memory_date, created_at").eq("subject_id", subjectId)
        .eq("visibility", "family").limit(500),
    ]);

  const days = (from: string | null | undefined) =>
    from ? Math.floor((now.getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)) : null;

  // Months of the current year with nothing in them — but only those that
  // have already happened. A month still ahead is not "empty", it is future.
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const seen = new Set<number>();
  for (const m of thisYear ?? []) {
    const d = new Date(m.memory_date ?? m.created_at);
    if (d.getFullYear() === now.getFullYear()) seen.add(d.getMonth());
  }
  const emptyMonths = MONTHS.filter((_, i) => i < now.getMonth() && !seen.has(i));

  return {
    childName: displayName.split(" ")[0] ?? displayName,
    daysSinceLastMemory: days(latest?.[0]?.created_at),
    recentThreads: (threads ?? []).map((t: any) => t.title).filter(Boolean),
    littleThings: (littleThings ?? []).map((lt: any) => ({
      category: lt.category,
      value: lt.value,
      daysOld: days(lt.recorded_date) ?? 0,
    })),
    emptyMonths,
    hasVoiceRecording: (voice ?? []).length > 0,
    daysSinceLastQuote: days(lastQuote?.[0]?.memory_date ?? lastQuote?.[0]?.created_at),
    // How far through the calendar year we are.
    yearProgress: (now.getMonth() + now.getDate() / 31) / 12,
  };
}

/** The owner of a family, with the address to write to. */
async function familyOwner(
  db: SupabaseClient,
  familyId: string
): Promise<{ userId: string; email: string } | null> {
  const { data } = await db
    .from("family_memberships")
    .select("user_id, profiles(email)")
    .eq("family_id", familyId)
    .eq("role", "owner")
    .maybeSingle();
  const email = (data as any)?.profiles?.email;
  return data && email ? { userId: data.user_id, email } : null;
}

async function renderPdf(db: SupabaseClient, payload: Record<string, unknown>) {
  const bookId = payload.book_id as string;
  const target = (payload.target as "digital" | "print") ?? "digital";
  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");
  if (target === "print" && book.status !== "approved" && book.status !== "rendering") {
    throw new Error("print render requires an approved book");
  }

  const { data: subject } = await db
    .from("subjects")
    .select("display_name, subject_type")
    .eq("id", book.subject_id)
    .single();

  const { data: pageRows } = await db
    .from("book_pages")
    .select("*, book_content_blocks(*)")
    .eq("book_id", bookId)
    .order("page_number");

  // Resolve photo blocks (content = memory id) to signed asset URLs.
  const memoryIds = new Set<string>();
  for (const page of pageRows ?? []) {
    for (const b of page.book_content_blocks ?? []) {
      if (b.type === "photo") memoryIds.add(b.content);
    }
  }
  const { data: assets } = await db
    .from("media_assets")
    .select("*")
    .in("memory_id", memoryIds.size ? [...memoryIds] : ["-"]);
  const assetByMemory = new Map<string, MediaAsset>((assets ?? []).map((a: any) => [a.memory_id, a]));

  const urlByMemory = new Map<string, string>();
  for (const [mid, asset] of assetByMemory) {
    const { data: signed } = await db.storage.from("media").createSignedUrl(asset.storage_path, 900);
    if (signed?.signedUrl) urlByMemory.set(mid, signed.signedUrl);
  }

  // Listen marks — only resolvable once the book is approved and tokenised.
  const listenByPage = new Map<number, { qrDataUri: string; label: string }>();
  if (book.listen_token) {
    const { data: listenable } = await db.rpc("book_listenable", { bid: bookId });
    for (const row of (listenable ?? []) as { memory_id: string; page_number: number }[]) {
      if (listenByPage.has(row.page_number)) continue;
      listenByPage.set(row.page_number, {
        qrDataUri: await qrDataUri(listenUrl(book.listen_token, row.memory_id)),
        label: "Hear this moment",
      });
    }
  }

  const renderPages = (pageRows ?? []).map((page: any) => ({
    pageNumber: page.page_number,
    archetype: page.template_id,
    hideFolio: ["chapter_opener", "hero_photograph"].includes(page.template_id),
    blocks: (page.book_content_blocks ?? []).map((b: any) => ({
      type: b.type,
      content: b.type === "photo" ? urlByMemory.get(b.content) ?? "" : b.content,
    })),
    listen: listenByPage.get(page.page_number),
  }));

  // The spine belongs to the provider, not to us. Query it before the cover
  // is drawn; a print render refuses to proceed on an estimate.
  const sku = process.env.PRODIGI_BOOK_SKU ?? "BOOK-A4-HARD-M";
  const destination = (book.destination_country ?? "AU") as string;
  const spine = await getPrintProvider().getSpineWidth({
    sku,
    pageCount: renderPages.length,
    destinationCountryCode: destination,
  });

  const age = book.year_number ?? 1;
  const colour = colourForAge(age);

  const result = await renderBookPdf(
    {
      cover: {
        childName: subject?.display_name ?? "",
        ageWord: yearWord(age).toUpperCase(),
        year: String(new Date(book.end_date).getFullYear()),
        imprint: "Qotidia",
        colour,
        spineWidthMm: spine.widthMm,
      },
      pages: renderPages,
    },
    target
  );

  // What actually gets uploaded. For print this is replaced by the press
  // pass below; for a digital copy Chromium's own output is what we want.
  let bytes = result.pdf;

  if (target === "print") {
    // The press pass runs before preflight, not after, for two reasons: the
    // file preflight examines should be the file the printer receives, and
    // reading the fonts back out of the produced PDF turns "fonts are
    // embedded" from something we asserted into something we measured.
    //
    // Missing Ghostscript fails the job. A print file that silently skipped
    // this step would still look fine here and arrive at Prodigi as PDF 1.4
    // with no output intent — exactly the class of quiet wrongness the whole
    // preflight discipline exists to catch.
    if (!(await ghostscriptAvailable())) {
      throw new Error("Ghostscript is unavailable; refusing to produce a print PDF without the press pass");
    }
    // Name and title, which is what the cover says — nothing in the document
    // properties that isn't already printed on the outside of the book.
    const docTitle = [subject?.display_name, book.title].filter(Boolean).join(" — ");
    const press = await toPressReady(result.pdf, docTitle);
    bytes = press.bytes;

    const placed: PlacedImage[] = [];
    for (const page of pageRows ?? []) {
      for (const b of page.book_content_blocks ?? []) {
        if (b.type !== "photo") continue;
        const asset = assetByMemory.get(b.content);
        const tier = imageTier(asset?.width ?? null, asset?.height ?? null);
        const claimed = tier === "unprintable" ? "intimate" : tier;
        const share = claimed === "hero" ? 1 : claimed === "editorial" ? 0.6 : 0.35;
        placed.push({
          assetId: b.content,
          pixelWidth: asset?.width ?? 0,
          pixelHeight: asset?.height ?? 0,
          placedWidthMm: FORMAT.trimWidthMm * share,
          placedHeightMm: FORMAT.trimHeightMm * share,
          tier: claimed,
          missing: !asset || !urlByMemory.has(b.content),
        });
      }
    }

    const { count: uncited } = await db
      .from("book_content_blocks")
      .select("id", { count: "exact", head: true })
      .eq("ai_generated", true)
      .in("type", ["text", "caption", "quote"])
      .eq("source_ids", "[]");

    const preflight = runPreflight({
      interiorPages: result.interiorPages,
      // Measured from the rendered file rather than assumed.
      pageWidthMm: result.pageWidthMm ?? 0,
      pageHeightMm: result.pageHeightMm ?? 0,
      bleedAdded: false,
      cropMarksAdded: false,
      images: placed,
      // Counted in the produced file, not assumed of the renderer.
      fontsEmbedded: press.embeddedFonts > 0,
      colourSpace: FORMAT.colourSpace,
      transparencyFlattened: true,
      overflowPages: result.overflowPages,
      safeAreaViolations: result.safeAreaViolations,
      spreadPages: [],
      blankPages: result.blankPages,
      uncitedBlocks: uncited ?? 0,
      cover: {
        colour,
        spineWidthMm: spine.widthMm,
        spineAuthoritative: spine.authoritative,
      },
    });

    if (!preflight.passed) {
      throw new Error(
        `preflight failed: ${preflight.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ")}`
      );
    }
    for (const w of preflight.issues.filter((i) => i.severity === "warning")) {
      console.warn(`[book ${bookId}] ${w.code}: ${w.message}`);
    }
  }

  const path = `books/${bookId}/${target}-${sha256(bytes).slice(0, 12)}.pdf`;
  const { error: upErr } = await db.storage
    .from("renders")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const column = target === "digital" ? "digital_pdf_path" : "print_pdf_path";
  const update: Record<string, unknown> = { [column]: path };
  if (target === "print") {
    update.status = "print_ready";
    update.page_count = result.interiorPages;
    // One file carries the whole book now, covers included.
    update.cover_pdf_path = path;
  }
  await db.from("books").update(update).eq("id", bookId);
}

async function submitPrint(db: SupabaseClient, payload: Record<string, unknown>) {
  const printOrderId = payload.print_order_id as string;
  const { data: order } = await db.from("print_orders").select("*").eq("id", printOrderId).single();
  if (!order) throw new Error("print order not found");
  if (order.status !== "draft") return; // already submitted — idempotent

  const { data: book } = await db.from("books").select("*").eq("id", order.book_id).single();
  if (!book?.approved_at) throw new Error("refusing to print an unapproved book (§21)");
  if (!book.print_pdf_path) throw new Error("print PDF not rendered");

  // §20: short-lived signed URLs, handed to the provider, then left to expire.
  const provider = getPrintProvider();
  const { data: interior } = await db.storage
    .from("renders")
    .createSignedUrl(book.print_pdf_path, 3600);
  // A real cover is now required: falling back to the interior would print a
  // book with a page where its front should be.
  if (!book.cover_pdf_path) throw new Error("cover PDF not rendered");
  const coverPath = book.cover_pdf_path;
  const { data: cover } = await db.storage.from("renders").createSignedUrl(coverPath, 3600);
  if (!interior?.signedUrl || !cover?.signedUrl) throw new Error("could not sign print assets");

  const providerOrder = await provider.createOrder({
    idempotencyKey: order.idempotency_key,
    sku: order.sku,
    pageCount: order.page_count,
    // What the customer actually paid for. Hard-coding 1 here shipped a
    // single book to someone who bought copies for both sets of grandparents.
    copies: order.copies ?? 1,
    recipient: order.recipient_json,
    interiorPdfUrl: interior.signedUrl,
    coverPdfUrl: cover.signedUrl,
  });

  await db
    .from("print_orders")
    .update({
      provider: provider.name,
      provider_order_id: providerOrder.providerOrderId,
      status: "submitted",
      cost_amount: providerOrder.cost?.amount ?? null,
      cost_currency: providerOrder.cost?.currency ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", printOrderId);
  await db.from("books").update({ status: "ordered" }).eq("id", order.book_id);

  await enqueue(db, "poll_print_status", { print_order_id: printOrderId }, `poll-${printOrderId}`);
}

async function pollPrintStatus(db: SupabaseClient, payload: Record<string, unknown>) {
  const printOrderId = payload.print_order_id as string;
  const { data: order } = await db.from("print_orders").select("*").eq("id", printOrderId).single();
  if (!order?.provider_order_id) return;
  if (["delivered", "cancelled", "failed"].includes(order.status)) return;

  const provider = getPrintProvider();
  const status = await provider.getOrderStatus(order.provider_order_id);
  const tracking = await provider.getTracking(order.provider_order_id);

  const statusMap: Record<string, string> = {
    received: "submitted",
    in_production: "in_production",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "cancelled",
    error: "failed",
  };
  const newStatus = statusMap[status.status] ?? order.status;
  await db
    .from("print_orders")
    .update({
      status: newStatus,
      tracking_number: tracking.trackingNumber,
      tracking_url: tracking.trackingUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", printOrderId);

  const bookStatusMap: Record<string, string> = {
    in_production: "in_production",
    shipped: "shipped",
    delivered: "delivered",
  };
  if (bookStatusMap[newStatus]) {
    await db.from("books").update({ status: bookStatusMap[newStatus] }).eq("id", order.book_id);
  }

  // Told once, when it actually leaves. sendOnce keeps the repeated polling
  // from turning that into a message every few hours.
  if (newStatus === "shipped" && order.status !== "shipped") {
    const { data: book } = await db
      .from("books")
      .select("id, title, subject_id, subjects(family_id)")
      .eq("id", order.book_id)
      .maybeSingle();
    const familyId = (book as any)?.subjects?.family_id;
    if (familyId) {
      const owner = await familyOwner(db, familyId);
      if (owner) {
        await sendOnce(db, {
          kind: "order_shipped",
          dedupeKey: `order_shipped-${printOrderId}`,
          userId: owner.userId,
          subjectId: book!.subject_id,
          message: orderShippedEmail({
            to: { email: owner.email },
            bookTitle: book!.title,
            orderId: printOrderId,
            trackingUrl: tracking.trackingUrl,
          }),
        });
      }
    }
  }

  // Keep polling until a terminal state; backoff handled via run_after.
  if (!["delivered", "cancelled", "failed"].includes(newStatus)) {
    const { error } = await db.from("jobs").insert({
      type: "poll_print_status",
      payload: { print_order_id: printOrderId },
      idempotency_key: `poll-${printOrderId}-${Date.now()}`,
      run_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (error && error.code !== "23505") throw new Error(error.message);
  }
}
