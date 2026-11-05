import { ArrowRight } from "lucide-react";
import Link from "next/link";

// The tour on Today in a pretend school from "Try it yourself"
// (docs/TRY_IT_YOURSELF.md): the four things worth seeing, in order, each
// one tap away. Shown instead of the set-up steps, which a visitor didn't do.
function steps(harper: string | null) {
  return [
    {
      href: "/business/fill",
      title: "Fill a spot",
      detail:
        "Charlie and Henry can't come this week. Offer their places to children who missed a lesson, in one tap.",
    },
    {
      href: "/business/retention",
      title: "See who might leave",
      detail: "Mia has missed three lessons in a row, and two families are behind on fees.",
    },
    {
      href: "/business/demand",
      title: "See what families want",
      detail: "Three families are waiting for a place in a full class. Ovyko spots the new class.",
    },
    {
      href: harper ? `/business/families/${harper}` : "/business/families",
      title: "Record a payment",
      detail:
        "The Harpers owe $260. Open their family and mark it paid, as you would after a bank transfer.",
    },
  ];
}

export function TryThese({ harper }: { harper: string | null }) {
  return (
    <section
      aria-labelledby="try-these"
      className="flex flex-col gap-4 rounded-lg border-2 border-ink bg-surface p-5"
    >
      <div>
        <h2 id="try-these" className="font-display text-2xl font-semibold tracking-tight">
          Try these four things
        </h2>
        <p className="text-muted">About five minutes. Tap one to start.</p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps(harper).map((s, i) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex min-h-12 items-center gap-3 rounded-md px-3 py-2 transition hover:bg-surface-soft"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-butter font-semibold">
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm text-muted">{s.detail}</span>
              </span>
              <ArrowRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
