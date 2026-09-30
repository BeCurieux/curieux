import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { SetupStep } from "@/lib/domain/invites";
import { cn } from "@/lib/utils";

// What's left to set up, on Today, until it's all done.
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;
  return (
    <section
      aria-labelledby="setup"
      className="flex flex-col gap-4 rounded-lg border-2 border-ink bg-surface p-5"
    >
      <div>
        <h2 id="setup" className="font-display text-2xl font-semibold tracking-tight">
          Getting set up
        </h2>
        <p className="text-muted">
          {steps.length - left} of {steps.length} done. Each step takes you where it&apos;s done.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-md px-3 py-2 transition hover:bg-surface-soft",
                s.done && "text-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 [&_svg]:size-4",
                  s.done ? "border-mint bg-mint text-ink" : "border-line",
                )}
              >
                {s.done ? <Check aria-label="Done" /> : null}
              </span>
              <span className="flex-1">
                <span className={cn("block font-semibold", s.done && "line-through")}>
                  {s.label}
                </span>
                {s.detail ? <span className="block text-sm text-muted">{s.detail}</span> : null}
              </span>
              {s.done ? null : <ArrowRight aria-hidden className="size-5 text-muted" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
