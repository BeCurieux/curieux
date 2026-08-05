// Checkout (brief §22).
//
// One product at one price. The landing page says "you pay for a book, you
// get a book" — so this page offers exactly that, plus grandparent copies on
// the same print run. Anything else here is a contradiction the customer
// discovers at the moment they are handing over money.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions";
import { MAX_EXTRA_COPIES, PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const aud = (cents: number) => `A$${(cents / 100).toFixed(0)}`;

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { bookId: string };
  searchParams: { cancelled?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: book } = await db.from("books").select("*").eq("id", params.bookId).single();
  if (!book) redirect("/home");

  const bookPrice = PRICES.bookAud();
  const extraPrice = PRICES.extraCopyAud();

  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-stone">Last step</p>
      <h1 className="mt-2 text-3xl">{book.title}</h1>

      {searchParams.cancelled && (
        <p className="mt-4 rounded-lg bg-card p-3 text-sm text-stone">
          Nothing was charged. Your book is exactly as you left it.
        </p>
      )}

      <div className="card mt-8 border-boot">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">The printed hardcover</h2>
          <span className="font-display text-3xl">{aud(bookPrice)}</span>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-stone">
          {[
            "A4 portrait hardcover, PUR bound, matte laminated",
            "Printed on Mohawk Superfine uncoated paper",
            "The digital copy, included",
            "Delivered to your door in about two weeks",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-ochre">&mdash;</span>
              {item}
            </li>
          ))}
        </ul>

        <form action={startCheckout} className="mt-6 space-y-3">
          <input type="hidden" name="book_id" value={book.id} />

          <div className="rounded border border-rule bg-paper/60 p-3">
            <label className="label" htmlFor="extra_copies">
              Extra copies &mdash; {aud(extraPrice)} each
            </label>
            <p className="mb-2 text-xs text-stone">
              For grandparents. Ordered now they ride along on the same print
              run; ordered later they cost full price.
            </p>
            <select className="input" id="extra_copies" name="extra_copies" defaultValue="0">
              {Array.from({ length: MAX_EXTRA_COPIES + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? "No extra copies" : `${n} extra ${n === 1 ? "copy" : "copies"}`}
                  {n > 0 ? ` — ${aud(n * extraPrice)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <p className="label pt-2">Deliver to</p>
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

          <button className="btn mt-2 w-full">Order the book</button>
          <p className="text-center text-xs text-stone">
            Payment is taken now. Nothing goes to print until it is paid, and
            the book you approved is the book that prints.
          </p>
        </form>
      </div>
    </div>
  );
}
