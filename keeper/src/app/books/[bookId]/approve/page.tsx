// Print approval (brief §24): explicit review checklist + confirmation.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { approveBook } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: { bookId: string };
  searchParams: { error?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: book } = await db.from("books").select("*").eq("id", params.bookId).single();
  if (!book) redirect("/home");
  if (book.status !== "review") redirect(`/books/${book.id}`);

  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl">This is their year. Make sure it feels true.</h1>
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <div className="card mt-8">
        <p className="text-sm text-ink/70">Before it prints, please check:</p>
        <ul className="mt-3 space-y-2 text-sm">
          {["Names correct", "Dates correct", "Stories correct", "Photos correct"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-clay">—</span> {item}
            </li>
          ))}
        </ul>
        <form action={approveBook} className="mt-6">
          <input type="hidden" name="book_id" value={book.id} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" className="mt-1" required />
            <span>I have reviewed this book and approve it for printing.</span>
          </label>
          <button className="btn mt-6 w-full">Approve &amp; continue</button>
        </form>
      </div>
    </div>
  );
}
