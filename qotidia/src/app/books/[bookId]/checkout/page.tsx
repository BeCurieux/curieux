// Checkout (brief §22).
//
// One product at one price. The landing page says "you pay for a book, you
// get a book" — so this page offers exactly that, plus grandparent copies on
// the same print run. Anything else here is a contradiction the customer
// discovers at the moment they are handing over money.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions";
import { AUTORENEW_TERMS, MAX_EXTRA_COPIES, PRICES, instalmentsOffered } from "@/lib/stripe";
import { bookPriceFor } from "@/lib/billing/price";
import { aud } from "@/lib/billing/money";

export const dynamic = "force-dynamic";

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

  // The same helper the action charges from. These were two calculations,
  // and the page's one did not know plans existed — so a monthly member was
  // shown A$199 and charged A$199 for a book they had partly or wholly paid
  // for already.
  const { data: subjectForPrice } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", book.subject_id)
    .single();
  const price = await bookPriceFor(db, subjectForPrice?.family_id ?? "");
  const bookPrice = price.amountAud;
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

      <div className="card mt-8 border-clay">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">The printed hardcover</h2>
          <span className="font-display text-3xl">
            {bookPrice === 0 ? "Included" : aud(bookPrice)}
          </span>
        </div>
        {/* The reason travels with the number. A price shown without one
            invites "why is this A$47?", and the answer has to be the same
            here, on the receipt, and in a support reply. */}
        {price.explanation && (
          <p className="mt-2 text-sm leading-relaxed text-ochre">{price.explanation}</p>
        )}
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
              run &mdash; and all of them come to your address, so you can
              write in them before you pass them on.</p>
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

          {/* Deliberately unticked. A saved card the customer did not ask
              for is how this product would end up in a consumer-affairs
              story, and the terms are stated here in full rather than
              behind a link nobody opens. */}
          <label className="mt-2 flex gap-3 rounded border border-rule bg-paper/60 p-3">
            <input type="checkbox" name="autorenew" className="mt-1" />
            <span>
              <span className="block text-sm">Do this again next year</span>
              <span className="mt-1 block text-xs leading-relaxed text-stone">
                {AUTORENEW_TERMS}
              </span>
            </span>
          </label>

          <button className="btn mt-2 w-full">Order the book</button>
          {instalmentsOffered() && (
            <p className="text-center text-xs text-stone">
              Pay in instalments if you&rsquo;d rather &mdash; choose it on the
              next screen. Still one book, still no subscription.
            </p>
          )}
          <p className="text-center text-xs text-stone">
            Payment is taken now. Nothing goes to print until it is paid, and
            the book you approved is the book that prints.
          </p>
        </form>
      </div>
    </div>
  );
}
