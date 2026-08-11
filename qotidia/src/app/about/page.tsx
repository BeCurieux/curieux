// Who is behind this.
//
// The section that matters is not the one about the person. It is "If I stop"
// — a solo product asking families to trust it with twenty years of their
// child's life owes an answer to the obvious question, and almost none of
// them give one. This one can, because the machinery is already built:
// export is a button, the book is a physical object that needs nothing from
// us, and a family can name a keeper who inherits the archive if the person
// who started it disappears.
//
// The rest is deliberately short. No founding story, no mission, no advisory
// board, no photograph of a laptop on a beach. lib/trust/people.ts argues why
// a name is only worth printing when it can be checked somewhere we do not
// control, and why nothing here invents one.

import Link from "next/link";
import { BRAND, ONE_LINER } from "@/lib/brand";
import { FROM } from "@/lib/email/provider";
import { HOW_MANY, WHERE, named } from "@/lib/trust/people";
import { NOTICE_DAYS, SILENT_FOR_DAYS } from "@/lib/succession/policy";
import { countOf } from "@/lib/words";

export const metadata = {
  title: `Who makes this — ${BRAND}`,
  description:
    "One person writes the software and answers the email. What happens to your family's archive if they stop, and why it does not depend on them.",
};

const MONTHS_SILENT = Math.round(SILENT_FOR_DAYS / 30.44);

export default function AboutPage() {
  const people = named();

  return (
    <div className="mx-auto !max-w-2xl py-16">
      <h1 className="max-w-[16ch] font-display leading-[1.05]" style={{ fontSize: "clamp(2.2rem, 6vw, 3.2rem)" }}>
        {HOW_MANY === 1 ? "One person makes this." : `${countOf(HOW_MANY, "person", "people")} make this.`}
      </h1>

      <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-stone">
        {ONE_LINER}
      </p>

      {/* --------------------------------------------------------- the people
          Named only where the name can be checked against something we do
          not control. Where it cannot, the page says the true thing rather
          than the impressive one — see lib/trust/people.ts. */}
      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">Who</h2>

        {people.length > 0 ? (
          <ul className="mt-8 space-y-8">
            {people.map((p) => (
              <li key={p.name}>
                <h3 className="font-display text-xl">{p.name}</h3>
                <p className="reading mt-2 max-w-[52ch] leading-relaxed text-stone">{p.does}</p>
                <p className="mt-2 text-sm text-stone">
                  {p.elsewhere.map((e, i) => (
                    <span key={e.url}>
                      {i > 0 && " · "}
                      <a
                        href={e.url}
                        rel="me noopener"
                        className="text-ochre underline decoration-ochre/30 underline-offset-4 hover:decoration-ochre"
                      >
                        {e.what}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="reading mt-4 max-w-[52ch] leading-relaxed text-stone">
            {HOW_MANY === 1 ? "One person" : countOf(HOW_MANY, "person", "people")} writes
            the software, answers the email and decides what gets built next,
            from {WHERE}. There is no team, no investor and no board.{" "}
            <a href={`mailto:${FROM.address}`} className="text-ochre">
              {FROM.address}
            </a>{" "}
            reaches them directly.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------- why it exists
          The reason for the product, not a biography. Anything about a
          person's own childhood would be invented, and the argument does not
          need it. */}
      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">Why this exists</h2>
        <div className="reading mt-4 max-w-[54ch] space-y-4 leading-relaxed text-stone">
          <p>
            The photographs are not the problem. Everybody has thousands, and
            the year your child was two is a folder of four thousand files that
            nobody will open again. What goes missing is everything around
            them: what the rabbit was called, why they would only sleep with
            the light on, the word they said wrong for eight months and then
            never again.
          </p>
          <p>
            None of that is in the photograph. The only place it exists is in
            a parent&rsquo;s head, and it does not stay there &mdash; not
            because anybody is careless, but because there is a new year
            arriving on top of it every year. This product is a way of
            catching a little of it while it is still there, and turning the
            year into an object that needs no login, no subscription and no
            company to still exist in 2050.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- if I stop
          The section a solo product owes and almost none of them write. All
          three answers are things already built rather than intentions. */}
      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">If I stop</h2>
        <p className="reading mt-4 max-w-[54ch] leading-relaxed text-stone">
          A fair question to ask one person holding twenty years of your
          child&rsquo;s life. There are three answers and none of them is
          &ldquo;that won&rsquo;t happen&rdquo;.
        </p>

        <ol className="mt-8 space-y-7">
          <li>
            <h3 className="font-display text-lg">The book needs nothing from us</h3>
            <p className="reading mt-2 max-w-[54ch] leading-relaxed text-stone">
              It is a printed hardcover on a shelf. It works during a power
              cut, it works if this company closes, and it will be readable by
              somebody who has never heard of {BRAND}. That is most of the
              reason the product ends in a physical object.
            </p>
          </li>
          <li>
            <h3 className="font-display text-lg">You can leave with all of it, today</h3>
            <p className="reading mt-2 max-w-[54ch] leading-relaxed text-stone">
              Not on request, and not after a support ticket. Every photograph
              at original quality and every word as you wrote it, in ordinary
              folders, from{" "}
              <Link href="/settings/privacy#export" className="text-ochre">
                one button in your settings
              </Link>
              . If you never trust anything else on this page, this is the one
              you can go and test in the next two minutes.
            </p>
          </li>
          <li>
            <h3 className="font-display text-lg">Your archive can outlive its owner</h3>
            <p className="reading mt-2 max-w-[54ch] leading-relaxed text-stone">
              You can{" "}
              <Link href="/settings/succession" className="text-ochre">
                name one person
              </Link>{" "}
              who takes the archive over. If they claim it, you get {NOTICE_DAYS}{" "}
              days of notice and repeated emails, and simply signing in refuses
              the claim. If an account goes quiet for {MONTHS_SILENT} months
              &mdash; long enough to have missed two of your own book
              anniversaries &mdash; the keeper you named may ask. If you named
              nobody, silence does nothing at all; we do not go looking for
              somebody to give a family&rsquo;s photographs to.
            </p>
          </li>
        </ol>
      </section>

      {/* ------------------------------------------------------- what we're not
          Cheaper to say than to be asked. Each of these is a decision with
          a page behind it, not a slogan. */}
      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">What this isn&rsquo;t</h2>
        <ul className="mt-6 space-y-3">
          {[
            ["A social network", "Nothing here is public, and there is nobody to follow."],
            ["Backup", "It holds what you chose to keep, not everything your phone took. Keep your photos backed up as well."],
            ["Free", "You pay for it, which is why there are no advertisements and nothing is sold."],
            ["A big company", `${HOW_MANY === 1 ? "One person" : countOf(HOW_MANY, "person", "people")}, in ${WHERE}, with no investors.`],
          ].map(([what, why]) => (
            <li key={what} className="flex gap-3">
              <span className="text-clay">&mdash;</span>
              <span className="leading-relaxed">
                <span>{what}</span>
                <span className="mt-0.5 block max-w-[48ch] text-sm text-stone">{why}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-14 border-t border-rule pt-8 text-sm leading-relaxed text-stone">
        <Link href="/help" className="text-ochre">What happens when you write in</Link>
        {" · "}
        <Link href="/promise" className="text-ochre">The nine privacy promises</Link>
        {" · "}
        <Link href="/privacy" className="text-ochre">How the whole thing works</Link>
      </p>
    </div>
  );
}
