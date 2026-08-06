// How we keep your family private.
//
// Not the privacy policy — the page a nervous parent actually reads. Six
// questions, answered in the first sentence, with the qualification after.
//
// Two things are deliberately not on this page. There are no security
// badges, because they mean nothing to the person asking. And there is no
// promise that data can never leak, because no honest company can make one:
// the credible promise is that we collect less, guard it, never sell it and
// let you leave with everything.

import Link from "next/link";
// The malware sentence prints only when a real engine is configured. A
// privacy claim backed by the mock scanner would be exactly the kind of
// thing this page exists to not do.
import { scannerIsReal } from "@/lib/media/scanner";
import { BACKUP_EXPIRY_DAYS } from "@/lib/privacy/erase";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `How we keep your family private — ${BRAND}`,
  description:
    "Private by default. No ads, no data sales, no AI training on your photographs. Export anytime, delete anytime.",
};

const QUESTIONS = [
  {
    q: "Can anyone else see my memories?",
    a: "No. Your family's archive is private unless you invite someone into it, one person at a time, by email. There are no public share links — not even secret ones — and nothing here is ever indexed by a search engine.",
  },
  {
    q: "Do you sell my data?",
    a: "No. We have never sold data and the business could not work if we did: you pay us for a book, so your family is the customer rather than the inventory. There is no advertising anywhere in this product and there never will be.",
  },
  {
    q: "Do you use my photographs to train AI?",
    a: "No — and more than that, we never send your photographs to an AI service at all. When the system works out what a year was about, it reads the words you wrote and the dates and tags. The images themselves stay in your private storage. Our AI provider is contractually barred from training on anything we do send.",
  },
  {
    q: "Can your staff see my photographs?",
    a: "Not as part of ordinary work. Nobody here browses family archives. If you ask us for help with something we cannot solve without looking, you grant access deliberately from your settings, it lasts 48 hours, it expires on its own, and it appears in your activity log — which you can read and we cannot edit.",
  },
  {
    q: "What happens if I leave?",
    a: `You take everything. One file with every photograph and recording at original quality, every note as you wrote it, and all your books — in plain folders you can open on any computer without our software. Then you can delete the archive permanently: gone from live systems immediately, and off encrypted backups within ${BACKUP_EXPIRY_DAYS} days.`,
  },
  {
    q: "Where is my information kept?",
    a: "In managed databases and private storage, encrypted in transit and at rest, with backups encrypted too. Photographs are never served from public URLs — every image you see is a temporary signed link that stops working within minutes.",
  },
];

const PILLARS = [
  ["Private by default", "Nothing is public. Ever."],
  ["No ads", "You are the customer, not the product."],
  ["No AI training", "Your photographs never leave for a model."],
  ["Export anytime", "Everything, in one file, at full quality."],
  ["Delete anytime", "Permanently, by yourself, in one place."],
];

export default function PrivacyExplainerPage() {
  return (
    <div className="-mx-6">
      <section className="bg-ink px-6 py-16 text-paper md:py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="max-w-[16ch] text-display">Their childhood isn&rsquo;t content.</h1>
          <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-paper/75">
            Some memories are meant to be shared. Not with everyone. This is a
            private place for your family, and the rest of this page is how you
            can check that rather than take our word for it.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <ul className="grid gap-4 py-12 sm:grid-cols-2 md:grid-cols-3">
          {PILLARS.map(([title, blurb]) => (
            <li key={title} className="card">
              <div className="text-sm">{title}</div>
              <div className="mt-1 text-xs leading-relaxed text-stone">{blurb}</div>
            </li>
          ))}
        </ul>

        <section className="border-t border-rule py-12">
          <h2 className="text-title">The six questions people ask</h2>
          <dl className="mt-10 space-y-10">
            {QUESTIONS.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-display text-xl leading-snug">{q}</dt>
                <dd className="mt-2 max-w-[62ch] leading-relaxed text-stone">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Where the archive actually goes, drawn plainly. Most people have
            never been shown what "AI-powered" means for their own files. */}
        <section className="border-t border-rule py-12">
          <h2 className="text-title">Where your photographs actually go</h2>
          <p className="mt-3 max-w-[54ch] text-stone">
            The short version: they go into your private storage and they stay
            there. Only words leave.
          </p>

          <ol className="mt-8 space-y-3">
            {[
              ["Your phone", "The photograph and what you wrote about it.", true],
              ["Encrypted on the way", "Nothing travels in the clear.", true],
              ["Read before it is stored", `Every file is opened server-side and checked that it is the kind of file it says it is. Anything that isn't is refused and never shown to anyone, including you.${scannerIsReal() ? " It is scanned for malware in the same pass." : ""}`, true],
              ["Your family's private archive", "Only people you invited can reach it. Images are served as links that expire in minutes.", true],
              ["What the AI sees", "The words, dates and tags only — never the photograph, never your address, never anything it doesn't need for the question being asked.", false],
              ["The result comes back", "A suggested grouping, or a question for you to answer. You decide what's true.", true],
              ["The book", "Printed by a manufacturer who receives the finished pages and nothing else, through a link that is revoked afterwards.", true],
            ].map(([step, detail, ours], i) => (
              <li key={String(step)} className="card flex gap-4">
                <span className="font-display text-2xl text-stone">{i + 1}</span>
                <span>
                  <span className="block">{String(step)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-stone">{String(detail)}</span>
                  {!ours && (
                    <span className="mt-2 block text-xs text-ochre">
                      The only step that leaves our systems — and the photograph doesn&rsquo;t go with it.
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-rule py-12">
          <h2 className="text-title">What we deliberately don&rsquo;t collect</h2>
          <p className="mt-3 max-w-[56ch] text-stone">
            The safest data is the data nobody has. We ask for a first name, a
            birthday and, if you like, their pronouns. That is the whole
            record. We don&rsquo;t ask for a surname, a school, an address, a
            location, or anything medical &mdash; and we don&rsquo;t build a
            face profile of your child or anyone else. Where a photograph needs
            a name attached, you attach it.
          </p>
        </section>

        <section className="border-t border-rule py-12">
          <h2 className="text-title">What we won&rsquo;t promise</h2>
          <p className="mt-3 max-w-[58ch] leading-relaxed text-stone">
            That nothing could ever go wrong. No honest company can promise
            that, and anyone who does is telling you something else about
            themselves. What we can promise is the part we control: we collect
            less than we could, we guard it properly, we never make money from
            it, and you can take all of it and leave whenever you want.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/settings/privacy" className="btn">Your archive settings</Link>
            <Link href="/signup" className="btn-secondary">Start a year</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
