// Background job handlers (brief §26).
// Each handler is idempotent: re-running a job after a crash produces the
// same end state and never duplicates print orders or payments.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIProvider } from "@/lib/ai/provider";
import { getPrintProvider } from "@/lib/print/provider";
import { enqueue, type Job } from "./queue";
import { paginateBook, littleThingsBlocks } from "@/lib/book/generate";
import { renderBookPdf, renderCoverPdf } from "@/lib/pdf/render";
import { runPreflight, runCoverPreflight, type PlacedImage } from "@/lib/pdf/preflight";
import { PAPER_STOCKS, coverGeometry, spineTakesText } from "@/lib/pdf/cover";
import { BOOK_SPEC } from "@/lib/book/structure";
import { sha256 } from "@/lib/media";
import { listenUrl, qrDataUri } from "@/lib/listen/qr";
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
};

export async function runJob(db: SupabaseClient, job: Job): Promise<void> {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`no handler for job type ${job.type}`);
  await handler(db, job.payload);
}

// ------------------------------------------------------------- helpers

async function loadMemories(db: SupabaseClient, subjectId: string): Promise<Memory[]> {
  const { data, error } = await db
    .from("memories")
    .select("*, memory_tags(tag), memory_people(family_members(name))")
    .eq("subject_id", subjectId);
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
}

async function renderPdf(db: SupabaseClient, payload: Record<string, unknown>) {
  const bookId = payload.book_id as string;
  const target = (payload.target as "digital" | "print" | "cover") ?? "digital";
  const { data: book } = await db.from("books").select("*").eq("id", bookId).single();
  if (!book) throw new Error("book not found");
  if (target !== "digital" && book.status !== "approved" && book.status !== "rendering") {
    throw new Error("print render requires an approved book (§21)");
  }

  if (target === "cover") {
    await renderCover(db, book);
    return;
  }

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
    const { data: signed } = await db.storage.from("media").createSignedUrl(asset.storage_path, 600);
    if (signed?.signedUrl) urlByMemory.set(mid, signed.signedUrl);
  }

  // "Hear this moment": a page whose quote came from a voice memory gets a
  // small printed code. Only possible once the book is approved, because the
  // token is minted then — a draft's codes would resolve to nothing.
  const listenByPage = new Map<number, { qrDataUri: string; label: string }>();
  if (book.listen_token) {
    const { data: listenable } = await db.rpc("book_listenable", { bid: bookId });
    for (const row of (listenable ?? []) as { memory_id: string; page_number: number }[]) {
      if (listenByPage.has(row.page_number)) continue; // one code per page
      listenByPage.set(row.page_number, {
        qrDataUri: await qrDataUri(listenUrl(book.listen_token, row.memory_id)),
        label: "Hear this moment",
      });
    }
  }

  const renderPages = (pageRows ?? []).map((page: any) => ({
    pageNumber: page.page_number,
    templateId: page.template_id,
    blocks: (page.book_content_blocks ?? []).map((b: any) => ({
      type: b.type,
      content: b.type === "photo" ? urlByMemory.get(b.content) ?? "" : b.content,
    })),
    listen: listenByPage.get(page.page_number),
  }));

  const result = await renderBookPdf(
    { title: book.title, subtitle: book.subtitle ?? undefined, pages: renderPages },
    target
  );

  if (target === "print") {
    // Preflight before the PDF is allowed anywhere near a printer (§18).
    const placed: PlacedImage[] = [];
    for (const page of pageRows ?? []) {
      for (const b of page.book_content_blocks ?? []) {
        if (b.type !== "photo") continue;
        const asset = assetByMemory.get(b.content);
        placed.push({
          assetId: b.content,
          pixelWidth: asset?.width ?? 0,
          pixelHeight: asset?.height ?? 0,
          placedWidthInches: BOOK_SPEC.trimWidthInches,
          placedHeightInches: BOOK_SPEC.trimHeightInches,
          missing: !asset || !urlByMemory.has(b.content),
        });
      }
    }
    const preflight = runPreflight({
      pageCount: result.pageCount,
      images: placed,
      fontsEmbedded: true, // Chromium embeds used fonts in print-to-PDF output
      overflowPages: result.overflowPages,
    });
    if (!preflight.passed) {
      throw new Error(
        `preflight failed: ${preflight.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")}`
      );
    }
  }

  const path = `books/${bookId}/${target}-${sha256(result.pdf).slice(0, 12)}.pdf`;
  const { error: upErr } = await db.storage
    .from("renders")
    .upload(path, result.pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const column = target === "digital" ? "digital_pdf_path" : "print_pdf_path";
  const update: Record<string, unknown> = { [column]: path };
  if (target === "print") update.status = "print_ready";
  await db.from("books").update(update).eq("id", bookId);
}

/**
 * The cover is a separate sheet whose width depends on how thick the book
 * physically is — so it can only be rendered once the page count is final,
 * i.e. after approval.
 */
async function renderCover(db: SupabaseClient, book: any) {
  const stock = PAPER_STOCKS[process.env.PAPER_STOCK ?? "mohawk_superfine_eggshell"];
  if (!stock) throw new Error(`unknown paper stock: ${process.env.PAPER_STOCK}`);

  const pageCount = book.page_count ?? 0;
  if (!pageCount) throw new Error("cannot size a spine without a final page count");

  const geo = coverGeometry(pageCount, stock);
  const spineText = spineTakesText(geo.spineWidthInches)
    ? `${book.title}${book.subtitle ? ` · ${book.subtitle}` : ""}`
    : undefined;

  const preflight = runCoverPreflight({ pageCount, stock, geometry: geo, spineText });
  if (!preflight.passed) {
    throw new Error(
      `cover preflight failed: ${preflight.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")}`
    );
  }
  for (const warning of preflight.issues.filter((i) => i.severity === "warning")) {
    console.warn(`[cover ${book.id}] ${warning.code}: ${warning.message}`);
  }

  // The front-cover photograph: the first full-bleed image in the book.
  let frontImageUrl: string | undefined;
  const { data: firstPhoto } = await db
    .from("book_pages")
    .select("book_content_blocks(type, content)")
    .eq("book_id", book.id)
    .order("page_number")
    .limit(4);
  const firstMemoryId = (firstPhoto ?? [])
    .flatMap((p: any) => p.book_content_blocks ?? [])
    .find((b: any) => b.type === "photo")?.content;
  if (firstMemoryId) {
    const { data: asset } = await db
      .from("media_assets")
      .select("storage_path")
      .eq("memory_id", firstMemoryId)
      .maybeSingle();
    if (asset) {
      const { data: signed } = await db.storage.from("media").createSignedUrl(asset.storage_path, 600);
      frontImageUrl = signed?.signedUrl;
    }
  }

  const pdf = await renderCoverPdf(
    { title: book.title, subtitle: book.subtitle ?? undefined, imprint: "Keeper", frontImageUrl },
    geo
  );

  const path = `books/${book.id}/cover-${sha256(pdf).slice(0, 12)}.pdf`;
  const { error } = await db.storage
    .from("renders")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);

  await db.from("books").update({ cover_pdf_path: path }).eq("id", book.id);
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
    copies: 1,
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
