// Where you go when something is wrong.
//
// There was nowhere. One mailto in the entire product, on the foot of the
// privacy promise, and a parent locked out of their child's archive at nine
// at night had no page to look at. Every other trust surface here is about
// what we might do wrong; this one is about what happens next, which is the
// question people actually have at the moment they need an answer.
//
// Deliberately not a help centre. No search box, no categories, no articles
// nobody wrote. A help centre is a way of not answering, and a product with
// one customer support person should be honest that the fastest route is to
// write to them. The four things at the foot are the ones people genuinely
// fix themselves in less time than an email takes.

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { countOf } from "@/lib/words";
import { FROM } from "@/lib/email/provider";
import {
  FOUNDER, HONEST_LIMIT, REPLY, SUPPORT_PROMISE, URGENT, whoReads,
} from "@/lib/trust/founder";

export const metadata = {
  title: `Getting help — ${BRAND}`,
  description:
    "One person answers every email, and it is the person who wrote the software. Urgent things within one business day, everything else within three.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto !max-w-2xl py-16">
      <h1 className="max-w-[16ch] font-display leading-[1.05]" style={{ fontSize: "clamp(2.2rem, 6vw, 3.2rem)" }}>
        Write to us and a person answers.
      </h1>

      <p className="mt-8 max-w-[50ch] text-lg leading-relaxed text-stone">
        Not a queue, not a bot, and not somebody reading from a script about
        software they have never opened. {whoReads()} reads every one.
      </p>

      {/* The address, big and early. Everything below this is the reason to
          trust it; this is the thing somebody in trouble actually came for,
          and burying it under six promises would be its own small failure. */}
      <p className="mt-10">
        <a
          href={`mailto:${FROM.address}`}
          className="font-display text-2xl text-clay underline decoration-clay/30 underline-offset-8 hover:decoration-clay md:text-3xl"
        >
          {FROM.address}
        </a>
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm">Within {countOf(REPLY.urgentDays, "business day")}</h2>
          <ul className="mt-2.5 space-y-1.5">
            {URGENT.map((u) => (
              <li key={u} className="flex gap-2.5 text-sm leading-relaxed text-stone">
                <span className="text-clay">&mdash;</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm">Within {countOf(REPLY.ordinaryDays, "business day")}</h2>
          <p className="mt-2.5 max-w-[32ch] text-sm leading-relaxed text-stone">
            Everything else &mdash; questions about the book, the printing,
            what the software is doing, or an idea you think we should build.
          </p>
          <p className="mt-2.5 max-w-[32ch] text-xs leading-relaxed text-stone">
            Business days in {FOUNDER.timezone}, which is where the person
            answering lives.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- the promise */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">What we promise about answering</h2>

        <ol className="mt-8 space-y-8">
          {SUPPORT_PROMISE.map((u) => (
            <li key={u.heading}>
              <h3 className="font-display text-lg leading-snug">{u.heading}</h3>
              <p className="reading mt-2 max-w-[54ch] leading-relaxed text-stone">{u.text}</p>
            </li>
          ))}
        </ol>

        {/* Which of the six the software enforces and which are conduct.
            Saying so is the part that makes the other five worth reading. */}
        <p className="reading mt-10 max-w-[54ch] border-l-2 border-rule pl-5 text-sm leading-relaxed text-stone">
          {HONEST_LIMIT}
        </p>
      </section>

      {/* ------------------------------------------------- faster than email
          Four things, because there are only four that are genuinely faster
          to do than to ask about. A fifth would be the beginning of a help
          centre. */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-2xl">Quicker than writing to us</h2>
        <ul className="mt-8 space-y-5">
          {[
            ["Take a copy of everything", "/settings/privacy#export", "Every photograph at original quality, in folders you can open without us."],
            ["See who can reach your archive", "/settings/privacy#activity", "Everyone who has looked, and when. Nothing is hidden from this list."],
            ["Change what we email you", "/settings/notifications", "Four a year you're glad of, or fewer."],
            ["Delete everything", "/settings/privacy#delete", "Yours to do, without asking anybody."],
          ].map(([label, href, blurb]) => (
            <li key={href}>
              <Link href={href} className="text-ochre underline decoration-ochre/30 underline-offset-4 hover:decoration-ochre">
                {label}
              </Link>
              <p className="mt-1 max-w-[48ch] text-sm leading-relaxed text-stone">{blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-16 border-t border-rule pt-8 text-sm leading-relaxed text-stone">
        The other things we&rsquo;ve written down:{" "}
        <Link href="/promise" className="text-ochre">the nine privacy promises</Link>
        {" · "}
        <Link href="/privacy" className="text-ochre">how the whole thing works</Link>
      </p>
    </div>
  );
}
