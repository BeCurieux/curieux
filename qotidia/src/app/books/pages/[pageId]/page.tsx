// Constrained page editor (brief §15): edit text, remove photos/blocks,
// swap between compatible layouts. No free-form dragging.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { changeTemplate, removeBlock, updateBlock } from "@/app/actions";
import { compatibleArchetypes, type ArchetypeId } from "@/lib/book/templates";
import { photoMemoryIds, resolvePhotoUrls } from "@/lib/book/photos";
import { WhyIsThisHere } from "./why";

export const dynamic = "force-dynamic";

export default async function PageEditor({ params }: { params: { pageId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: page } = await db
    .from("book_pages")
    .select("*, books(id, title, status), book_content_blocks(*)")
    .eq("id", params.pageId)
    .single();
  if (!page) redirect("/home");
  const book = page.books as any;
  const editable = book.status === "review";
  const templates = compatibleArchetypes(page.template_id as ArchetypeId, "hero");
  const photoUrls = await resolvePhotoUrls(db, photoMemoryIds(page.book_content_blocks ?? []));

  return (
    <div className="py-10">
      <Link href={`/books/${book.id}`} className="text-sm text-ochre">&larr; {book.title}</Link>
      <h1 className="mt-2 text-3xl">Page {page.page_number}</h1>

      {editable && templates.length > 1 && (
        <div className="mt-6">
          <span className="label">Layout</span>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <form key={t.id} action={changeTemplate}>
                <input type="hidden" name="page_id" value={page.id} />
                <input type="hidden" name="template_id" value={t.id} />
                <button
                  className={`rounded-full px-4 py-1.5 text-xs ${
                    t.id === page.template_id ? "bg-ink text-paper" : "border border-rule hover:border-clay"
                  }`}
                >
                  {t.name}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {(page.book_content_blocks ?? []).map((block: any) => (
          <div key={block.id} className="card">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-stone">
                {block.type}
                {block.ai_generated && !block.parent_edited && " · drafted for you"}
                {block.parent_edited && " · edited by you"}
              </span>
              <div className="flex items-center gap-3">
                {block.ai_generated && (block.source_ids ?? []).length > 0 && (
                  <WhyIsThisHere sources={block.source_ids} />
                )}
                {editable && block.type !== "heading" && (
                  <form action={removeBlock}>
                    <input type="hidden" name="block_id" value={block.id} />
                    <input type="hidden" name="page_id" value={page.id} />
                    <button className="text-xs text-stone hover:text-red-600">Remove</button>
                  </form>
                )}
              </div>
            </div>
            {block.type === "photo" ? (
              photoUrls.has(block.content) ? (
                <img
                  src={photoUrls.get(block.content)}
                  alt=""
                  className="mt-2 max-h-80 w-full rounded object-cover"
                />
              ) : (
                <div className="mt-2 flex h-32 items-center justify-center rounded bg-rule text-xs text-stone">
                  photograph unavailable
                </div>
              )
            ) : editable ? (
              <form action={updateBlock} className="mt-2 flex items-start gap-2">
                <input type="hidden" name="block_id" value={block.id} />
                <input type="hidden" name="page_id" value={page.id} />
                <textarea className="input min-h-20 flex-1" name="content" defaultValue={block.content} />
                <button className="btn-secondary !px-4 !py-2 text-xs">Save</button>
              </form>
            ) : (
              <p className="mt-2">{block.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
