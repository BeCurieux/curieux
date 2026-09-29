import { CalendarCheck, Check, Plus, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

// The public website at ovyko.com.au: what signed-out visitors see at "/".
// Content mirrors the brochure. No prices until they are decided
// (see the pricing plan); schools book a demo by email.

const DEMO_MAILTO =
  "mailto:hello@ovyko.com.au?subject=Ovyko%20demo&body=School%20name%3A%0AActivity%3A%0APhone%3A";

const BENEFITS = [
  {
    icon: Plus,
    tint: "bg-butter",
    title: "Absences become filled places",
    body: "Every reported absence frees a spot that another family can take.",
  },
  {
    icon: CalendarCheck,
    tint: "bg-lilac",
    title: "Make-ups without the phone calls",
    body: "Parents report an absence and pick a make-up that fits your rules.",
  },
  {
    icon: TrendingUp,
    tint: "bg-mint",
    title: "Progress parents actually see",
    body: "Instructors tick off skills poolside. Families see the milestone that night.",
  },
];

const STEPS = [
  {
    tint: "bg-surface-soft",
    title: "A parent taps “Can’t make it”",
    body: "From their phone, in seconds.",
  },
  {
    tint: "bg-[#fcefd0]",
    title: "Your make-up rules apply",
    body: "Notice period, credit length, levels: your policy, checked for you.",
  },
  {
    tint: "bg-[#fde3dd]",
    title: "They book a class that fits",
    body: "Only classes with a real, open place.",
  },
  {
    tint: "bg-[#dff1ea]",
    title: "The spot they left gets filled",
    body: "Offered to another family with a credit.",
  },
];

const AUDIENCES = [
  {
    title: "For your business",
    items: [
      "Classes, levels and locations in one timetable",
      "Lessons scheduled for you, week after week",
      "Rosters, capacity and open spots at a glance",
      "Every change recorded, and who made it",
    ],
  },
  {
    title: "For families",
    items: [
      "Every child’s week in one app",
      "Report an absence in two taps",
      "Book make-ups without calling",
      "See each new skill as it’s achieved",
    ],
  },
  {
    title: "For instructors",
    items: [
      "Today’s classes, nothing else",
      "Big one-tap attendance, poolside",
      "Update skills in seconds",
      "Families see the progress straight away",
    ],
  },
];

function ExampleScreens() {
  return (
    <figure className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-[1fr_260px] md:items-end">
        <div className="flex flex-col gap-4 rounded-lg bg-ink p-6 text-white sm:p-8">
          <p className="flex items-center gap-2 font-semibold text-butter">
            <Sparkles aria-hidden className="size-5" />
            Fill empty spots
          </p>
          <p className="font-display text-3xl leading-tight font-semibold">
            4 spots can be filled this week
          </p>
          <p className="text-[#d9dae2]">
            A child is away Wednesday. Ovyko opens their place to families holding make-up credits.
          </p>
          <ul className="flex flex-col gap-2">
            {["Dolphin 3 · Wed 4:30pm", "Dolphin 3 · Sat 9:00am"].map((c) => (
              <li
                key={c}
                className="flex items-center justify-between gap-3 rounded-md bg-[#2b2e3d] px-4 py-3 font-semibold"
              >
                {c}
                <span className="rounded-full bg-coral px-3 py-1 text-sm font-bold text-ink">
                  1 to fill
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 rounded-lg bg-coral p-5 text-ink shadow-[0_18px_40px_-24px_rgba(31,34,48,0.55)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Your swim school</span>
              <span className="rounded-full bg-white/60 px-2.5 py-1 text-xs font-bold tracking-wide">
                DOLPHIN 3
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">Ava</p>
              <p className="font-display text-3xl leading-none font-semibold">Swimming</p>
            </div>
            <p className="font-display text-lg font-semibold">Wednesday · 4:30pm</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint">
              <Check aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-muted">Make-up booked</p>
              <p className="font-bold">Saturday 9:00am</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="text-sm text-muted">Example screens from the Ovyko app.</figcaption>
    </figure>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Wordmark />
        <nav aria-label="Site" className="flex items-center gap-2">
          <span className="hidden text-sm font-semibold text-muted md:inline">
            For swim schools, gymnastics, dance &amp; martial arts
          </span>
          <Button asChild variant="soft" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <section aria-labelledby="hero" className="flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-6">
            <h1
              id="hero"
              className="font-display text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl"
            >
              Fill classes.
              <br />
              Retain families.
              <br />
              <span className="text-[#b54a33]">Do less admin.</span>
            </h1>
            <p className="max-w-2xl text-lg text-[#3d4050] sm:text-xl">
              Ovyko is one calm place to run your recurring weekly classes: timetable, families,
              absences, make-ups and progress, with an app parents actually enjoy opening.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="warm" size="lg">
                <a href={DEMO_MAILTO}>Book a demo</a>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <a href="#demo">Watch the demo</a>
              </Button>
            </div>
          </div>
          <ExampleScreens />
        </section>

        <section id="demo" aria-labelledby="demo-heading" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2
              id="demo-heading"
              className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
            >
              Watch the 1-minute demo
            </h2>
            <p className="max-w-2xl text-[#3d4050]">
              One missed swimming lesson, handled by a parent, the owner and an instructor. Captions
              on screen, no sound needed.
            </p>
          </div>
          <video
            controls
            playsInline
            preload="none"
            poster="/ovyko-demo-poster.jpg"
            aria-label="Ovyko demo video"
            className="aspect-video w-full rounded-lg border border-line bg-surface shadow-[0_20px_50px_-30px_rgba(31,34,48,0.5)]"
          >
            <source src="/ovyko-demo.mp4" type="video/mp4" />
          </video>
        </section>

        <section aria-label="Why schools use Ovyko" className="grid gap-4 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, tint, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6"
            >
              <span className={`grid size-11 place-items-center rounded-full ${tint}`}>
                <Icon aria-hidden className="size-5" />
              </span>
              <h2 className="font-display text-xl leading-snug font-semibold">{title}</h2>
              <p className="text-[#3d4050]">{body}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" aria-labelledby="how" className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="font-bold tracking-wide text-[#b54a33]">HOW IT WORKS</p>
            <h2
              id="how"
              className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
            >
              One missed lesson, handled in minutes.
            </h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`flex flex-col gap-2 rounded-lg p-5 ${s.tint}`}>
                <span className="font-display text-3xl font-semibold">{i + 1}</span>
                <span className="font-bold">{s.title}</span>
                <span className="text-sm text-[#3d4050]">{s.body}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6"
              >
                <h3 className="font-display text-2xl font-semibold">{a.title}</h3>
                <ul className="flex flex-col gap-2">
                  {a.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="privacy"
          className="flex flex-col gap-5 rounded-lg bg-surface-soft p-6 sm:flex-row sm:p-8"
        >
          <span className="grid size-13 shrink-0 place-items-center rounded-full bg-ink text-white">
            <ShieldCheck aria-hidden className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h2 id="privacy" className="font-display text-2xl font-semibold">
              Built for children’s privacy
            </h2>
            <p className="max-w-3xl text-[#3d4050]">
              Your families belong to your business alone. Parents see only their own children, and
              instructors only the children they teach. Every change is recorded. Data is hosted in
              Sydney.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="pilot"
          className="flex flex-col gap-6 rounded-lg bg-ink p-6 text-white sm:p-10 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex flex-col gap-2">
            <h2 id="pilot" className="font-display text-3xl leading-tight font-semibold">
              Now welcoming pilot schools
            </h2>
            <p className="text-[#d9dae2]">
              Recurring weekly classes with levels? Let’s set up your timetable together.
            </p>
          </div>
          <Button asChild variant="warm" size="lg" className="w-fit">
            <a href={DEMO_MAILTO}>Email hello@ovyko.com.au</a>
          </Button>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-line px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>Ovyko is made by Sounding Labs · ABN 38 813 430 864</p>
        <p className="flex gap-4">
          <a href="mailto:hello@ovyko.com.au" className="underline underline-offset-2">
            hello@ovyko.com.au
          </a>
          <Link href="/sign-in" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}
