// Checkout (brief §22): digital creation, physical upgrade after preview.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions";
import { PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: { bookId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: book } = await db.from("books").select("*").eq("id", params.bookId).single();
  if (!book) redirect("/home");

  const digital = (PRICES.digitalAud() / 100).toFixed(0);
  const print = (PRICES.printAud() / 100).toFixed(0);

  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="text-3xl">{book.title}</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl">Digital book</h2>
          <p className="mt-1 text-sm text-ink/60">The complete book as a beautiful PDF, yours to keep.</p>
          <p className="mt-4 font-display text-3xl">A${digital}</p>
          <form action={startCheckout} className="mt-4">
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="kind" value="digital" />
            <button className="btn-secondary w-full">Get the digital book</button>
          </form>
        </div>

        <div className="card border-clay">
          <h2 className="text-xl">Printed hardcover</h2>
          <p className="mt-1 text-sm text-ink/60">
            A4 portrait, matte-laminated hardcover. Includes the digital book.
          </p>
          <p className="mt-4 font-display text-3xl">A${print}</p>
          <form action={startCheckout} className="mt-4 space-y-3">
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="kind" value="print" />
            <input className="input" name="name" placeholder="Recipient name" required />
            <input className="input" name="line1" placeholder="Address line 1" required />
            <input className="input" name="line2" placeholder="Address line 2 (optional)" />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" name="city" placeholder="City" required />
              <input className="input" name="region" placeholder="State" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" name="postcode" placeholder="Postcode" required />
              <select className="input" name="country" defaultValue="AU">
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
              </select>
            </div>
            <button className="btn w-full">Order the hardcover</button>
          </form>
        </div>
      </div>
    </div>
  );
}
