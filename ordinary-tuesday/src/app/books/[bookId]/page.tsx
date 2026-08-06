// Book overview (brief §15): full book as page thumbnails; click to edit.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { removePage } from "@/app/actions";
import { photoMemoryIds, resolvePhotoUrls } from "@/lib/book/photos";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  collecting: "Still gathering",
  drafting: "Being put together",
  review: "Yours to read",
  approved: "Approved — getting it ready",
  rendering: "Getting it ready",
  print_ready: "Ready to print",
  ordered: "Ordered",
  in_production: "On the press",
  shipped: "On its way to you",
  delivered: "With you",
};

export default async function BookOverview({ params }: { params: { bookId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: book } = await db.from("books").select("*").eq("id", params.bookId).single();
  if (!book) redirect("/home");

  const { data: pages } = await db
    .from("book_pages")
    .select("*, book_sections(title), book_content_blocks(type, content)")
    .eq("book_id", book.id)
    .order("page_number");

  const photoUrls = await resolvePhotoUrls(
    db,
    photoMemoryIds((pages ?? []).flatMap((p: any) => p.book_content_blocks ?? []))
  );

  const { data: order } = await db
    .from("print_orders")
    .select("id")
    .eq("book_id", book.id)
    .neq("status", "draft")
    .maybeSingle();

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{book.title}</h1>
          <p className="mt-1 text-stone">
            {book.subtitle} · {STATUS_LABEL[book.status] ?? book.status}
            {book.page_count ? ` · ${book.page_count} pages` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          {order && <Link href={`/orders/${order.id}`} className="btn-secondary">Order status</Link>}
          {book.status === "review" && (
            <>
              <Link href={`/books/${book.id}/preview`} className="btn-secondary">Preview</Link>
              <Link href={`/books/${book.id}/approve`} className="btn">Approve for print</Link>
            </>
          )}
          {(book.status === "approved" || book.status === "print_ready") && !order && (
            <Link href={`/books/${book.id}/checkout`} className="btn">Order their book</Link>
          )}
        </div>
      </div>

      {(book.status === "collecting" || book.status === "drafting") && (
        <p className="mt-10 max-w-[52ch] rounded-lg bg-rule/50 p-6 text-sm leading-relaxed">
          We&rsquo;re reading through everything you&rsquo;ve kept and working
          out the shape of the year. It takes a few minutes. Go and do
          something else &mdash; we&rsquo;ll be here.
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(pages ?? []).map((page) => {
          const blocks = page.book_content_blocks ?? [];
          const heading = blocks.find((b: any) => b.type === "heading");
          const photoCount = blocks.filter((b: any) => b.type === "photo").length;
          const quote = blocks.find((b: any) => b.type === "quote");
          return (
            <div key={page.id} className="group relative">
              <Link
                href={`/books/pages/${page.id}`}
                className="card block aspect-[1/1.41] overflow-hidden !p-4 transition hover:border-clay"
              >
                {/* The template id is ours, not theirs. A parent looking at
                    their child's book should see the chapter it belongs to —
                    "portrait_plus_story" is a fact about our layout engine. */}
                <div className="text-[10px] uppercase tracking-wider text-stone">
                  {page.book_sections?.title
                    ? `${page.book_sections.title} · ${page.page_number}`
                    : `Page ${page.page_number}`}
                </div>
                {heading && <div className="mt-2 font-display text-sm">{heading.content}</div>}
                {quote && <div className="mt-2 text-xs italic text-stone">&ldquo;{quote.content.slice(0, 60)}&rdquo;</div>}
                {photoCount > 0 && (
                  <div className="mt-2 flex gap-1">
                    {blocks
                      .filter((b: any) => b.type === "photo")
                      .slice(0, 3)
                      .map((b: any, i: number) =>
                        photoUrls.has(b.content) ? (
                          <img key={i} src={photoUrls.get(b.content)} alt=""
                               className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div key={i} className="h-10 w-10 rounded bg-rule" />
                        )
                      )}
                  </div>
                )}
              </Link>
              {book.status === "review" && (
                <form action={removePage} className="absolute right-2 top-2 hidden group-hover:block">
                  <input type="hidden" name="page_id" value={page.id} />
                  <input type="hidden" name="book_id" value={book.id} />
                  {/* Taking a page out of your child's book is a considered
                      act, not a destructive one. It shouldn't be in red. */}
                  <button
                    className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs text-stone shadow hover:text-ink"
                    title="Leave this page out of the book"
                  >
                    leave out
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
