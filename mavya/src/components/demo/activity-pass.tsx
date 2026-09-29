import { Waves } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A child's weekly activity, styled as a wallet pass: provider on top, the
// activity big, the child and time along the bottom.
export function ActivityPass({
  colour,
  provider,
  activity,
  level,
  child,
  when,
  status,
  className,
}: {
  colour: "coral" | "mint" | "butter" | "lilac";
  provider: string;
  activity: string;
  level: string;
  child: string;
  when: string;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "pass text-ink shadow-[0_18px_40px_-24px_rgba(31,34,48,0.55)]",
        `pass-${colour}`,
        className,
      )}
    >
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-white/60 [&_svg]:size-4">
              <Waves aria-hidden strokeWidth={2.5} />
            </span>
            {provider}
          </span>
          <span className="rounded-full bg-white/55 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            {level}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold opacity-75">{child}</p>
          <h3 className="font-display text-[2rem] leading-none font-semibold tracking-tight">
            {activity}
          </h3>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="tabular font-display text-xl font-semibold">{when}</p>
          {status}
        </div>
      </div>
    </article>
  );
}

// Solid fills for a child's colour, written out so Tailwind can see them.
export const CHILD_FILL = {
  coral: "bg-coral",
  mint: "bg-mint",
  butter: "bg-butter",
  lilac: "bg-lilac",
} as const;
