// On-screen book preview — same content that drives the PDF render.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { photoMemoryIds, resolvePhotoUrls } from "@/lib/book/photos";

export const dynamic = "force-dynamic";

export default async function PreviewPage(props: { params: Promise<{ bookId: string }> }) {
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await userClient();

  const { data: book } = await db.from("books").select("*").eq("id", params.bookId).single();
  if (!book) redirect("/home");
  const { data: pages } = await db
    .from("book_pages")
    .select("*, book_content_blocks(*)")
    .eq("book_id", book.id)
    .order("page_number");

  // The approval checklist asks the parent to confirm "Photos correct", so
  // the preview has to actually show them.
  const photoUrls = await resolvePhotoUrls(
    db,
    photoMemoryIds((pages ?? []).flatMap((p: any) => p.book_content_blocks ?? []))
  );

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <Link href={`/books/${book.id}`} className="text-sm text-ochre">&larr; Back</Link>
        {book.status === "review" && (
          <Link href={`/books/${book.id}/approve`} className="btn">This feels true — approve it</Link>
        )}
      </div>

      <div className="mx-auto mt-8 max-w-2xl space-y-8">
        <div className="card flex aspect-[1/1.41] flex-col items-center justify-center text-center">
          <h1 className="text-4xl">{book.title}</h1>
          {book.subtitle && <p className="mt-3 font-display text-xl text-stone">{book.subtitle}</p>}
        </div>
        {(pages ?? []).map((page: any) => (
          <div key={page.id} className="card aspect-[1/1.41] overflow-hidden">
            <div className="mb-3 text-[10px] uppercase tracking-wider text-stone">
              page {page.page_number}
            </div>
            {(page.book_content_blocks ?? []).map((block: any) => (
              <div key={block.id} className="mb-3">
                {block.type === "heading" && <h2 className="text-2xl">{block.content}</h2>}
                {block.type === "text" && <p className="text-sm leading-relaxed">{block.content}</p>}
                {block.type === "caption" && <p className="text-xs text-stone">{block.content}</p>}
                {block.type === "quote" && (
                  <p className="font-display text-xl italic">&ldquo;{block.content}&rdquo;</p>
                )}
                {block.type === "photo" && (
                  photoUrls.has(block.content) ? (
                    <img
                      src={photoUrls.get(block.content)}
                      alt=""
                      className="max-h-72 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded bg-rule text-xs text-stone">
                      photograph unavailable
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
