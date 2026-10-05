import { CalendarCheck, Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/wordmark";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { Button } from "@/components/ui/button";
import { FOUNDING } from "@/lib/site/founding";

export const metadata: Metadata = {
  title: { absolute: "Ovyko · Founding swim schools" },
  description:
    "Ovyko fills places that would sit empty, collects your fees and chases the late ones. Join the founding schools waitlist.",
  robots: { index: true, follow: true },
};

const REASONS = [
  {
    icon: Plus,
    tint: "bg-butter",
    title: "Absences become filled places",
    body: "A parent taps “can’t make it”, books a make-up that fits your rules, and their spot is offered to another family. Nobody at the desk touches it.",
  },
  {
    icon: Wallet,
    tint: "bg-mint",
    title: "Fees that collect themselves",
    body: "Card, direct debit or instalments, reminders before and after the due date, and failed payments chased for you.",
  },
  {
    icon: CalendarCheck,
    tint: "bg-lilac",
    title: "Re-enrolment in one tap",
    body: "Families confirm next term from their phone, and you see who’s staying before the term starts.",
  },
];

// The founding-schools waitlist (docs/WAITLIST_PAGE.md). The offer, the
// area and the founder's note only show once they're decided in
// src/lib/site/founding.ts.
export default function FoundingPage() {
  const where = FOUNDING.area ? ` in ${FOUNDING.area}` : "";
  const when = FOUNDING.opensBefore ? ` before ${FOUNDING.opensBefore}` : "";
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Ovyko home">
          <Wordmark />
        </Link>
        <Link href="/sign-in" className="font-semibold text-muted hover:text-ink">
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 pt-4 pb-16 sm:px-6">
        <section aria-labelledby="hero" className="flex max-w-3xl flex-col gap-5">
          <p className="font-semibold text-[#b54a33]">Founding schools</p>
          <h1
            id="hero"
            className="font-display text-5xl leading-[1.02] font-semibold tracking-tight sm:text-6xl"
          >
            Your swim school, on autopilot.
          </h1>
          <p className="text-lg text-[#3d4050] sm:text-xl">
            Ovyko fills places that would sit empty, collects your fees and chases the late ones, so
            your front desk stops doing it by hand.
          </p>
          <Button asChild variant="warm" size="lg" className="w-fit">
            <a href="#join">Join the founding schools waitlist</a>
          </Button>
        </section>

        <section aria-label="Why schools use Ovyko" className="grid gap-4 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, tint, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-lg bg-surface p-6 shadow-[0_1px_0_var(--border)]"
            >
              <span
                className={`grid size-11 place-items-center rounded-full ${tint} [&_svg]:size-5`}
              >
                <Icon aria-hidden />
              </span>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-[#3d4050]">{body}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="month" className="flex max-w-3xl flex-col gap-3">
          <h2 id="month" className="font-display text-3xl font-semibold tracking-tight">
            See what it did for you
          </h2>
          <p className="text-[#3d4050]">
            At the end of every month, Ovyko shows you what it handled: places filled, fees
            collected, overdue fees paid, families staying, and the hours your desk got back.
          </p>
        </section>

        <section aria-labelledby="moving" className="flex max-w-3xl flex-col gap-3">
          <h2 id="moving" className="font-display text-3xl font-semibold tracking-tight">
            Moving in is the scary part, so we do it
          </h2>
          <p className="text-[#3d4050]">
            We move your classes and families in from your current system, show you the counts
            match, and run alongside it until you&apos;re sure.
          </p>
        </section>

        <section aria-labelledby="safe" className="flex max-w-3xl flex-col gap-3">
          <h2 id="safe" className="font-display text-3xl font-semibold tracking-tight">
            Careful with children&apos;s details
          </h2>
          <p className="text-[#3d4050]">
            {FOUNDING.dataInAustralia ? "Your data stays in Australia. " : ""}Health notes reach
            only the instructors who need them. Owners sign in with two-step codes. Families can
            download or delete their data when they ask.
          </p>
        </section>

        <section
          id="join"
          aria-labelledby="join-heading"
          className="flex scroll-mt-6 flex-col gap-6 rounded-lg bg-surface p-6 shadow-[0_1px_0_var(--border)] sm:p-8"
        >
          <div className="flex max-w-3xl flex-col gap-3">
            <h2 id="join-heading" className="font-display text-3xl font-semibold tracking-tight">
              Founding schools{where}
            </h2>
            <p className="text-[#3d4050]">
              {FOUNDING.places
                ? `We're opening to ${FOUNDING.places} swim schools${where}${when}.`
                : `We're opening Ovyko to a small group of founding swim schools${where}${when}.`}{" "}
              We can only move a few schools in properly at once, so it&apos;s first come.
            </p>
            {FOUNDING.offer.length > 0 ? (
              <ul aria-label="Founding schools get" className="flex flex-col gap-1 font-semibold">
                {FOUNDING.offer.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <WaitlistForm />
        </section>

        {FOUNDING.founderNote ? (
          <section aria-label="From the founder" className="flex max-w-3xl flex-col gap-2">
            <p className="text-lg text-[#3d4050]">{FOUNDING.founderNote.text}</p>
            <p className="font-semibold">{FOUNDING.founderNote.name}, founder</p>
          </section>
        ) : null}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-sm text-muted sm:px-6">
        Ovyko is made by Sounding Labs · ABN 38 813 430 864 ·{" "}
        <a href="mailto:hello@ovyko.com.au" className="underline">
          hello@ovyko.com.au
        </a>
      </footer>
    </div>
  );
}
