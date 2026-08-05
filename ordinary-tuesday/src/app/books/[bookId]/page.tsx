// Book overview (brief §15): full book as page thumbnails; click to edit.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { removePage } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  collecting: "Gathering their year…",
  drafting: "Putting their year together…",
  review: "Ready for your review",
  approved: "Approved — preparing print files",
  rendering: "Preparing print files",
  print_ready: "Ready to print",
  ordered: "Order placed",
  in_production: "Being printed",
  shipped: "On its way",
  delivered: "Delivered",
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
        <p className="mt-10 rounded-lg bg-rule/50 p-6 text-sm">
          We&rsquo;re assembling the book from their memories. This can take a few minutes —
          you can leave and come back.
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
                className="card block aspect-[1/1.41] overflow-hidden !p-4 transition hover:border-boot"
              >
                <div className="text-[10px] uppercase tracking-wider text-stone">
                  p.{page.page_number} · {page.template_id.replace(/_/g, " ")}
                </div>
                {heading && <div className="mt-2 font-display text-sm">{heading.content}</div>}
                {quote && <div className="mt-2 text-xs italic text-stone">&ldquo;{quote.content.slice(0, 60)}&rdquo;</div>}
                {photoCount > 0 && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: Math.min(photoCount, 3) }).map((_, i) => (
                      <div key={i} className="h-8 w-8 rounded bg-rule" />
                    ))}
                  </div>
                )}
              </Link>
              {book.status === "review" && (
                <form action={removePage} className="absolute right-2 top-2 hidden group-hover:block">
                  <input type="hidden" name="page_id" value={page.id} />
                  <input type="hidden" name="book_id" value={book.id} />
                  <button className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-red-600 shadow">
                    remove
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
