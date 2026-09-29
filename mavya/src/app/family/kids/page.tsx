import { ArrowRight, Smile } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CHILD_FILL } from "@/components/demo/activity-pass";
import { EmptyState } from "@/components/demo/empty-state";
import { ProgressRing } from "@/components/demo/progress-ring";
import { familyContext } from "@/lib/demo/context";
import { familyChildren } from "@/lib/demo/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kids" };

export default async function KidsPage() {
  const { state, demo } = await familyContext();

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Kids</h1>
      {!demo ? (
        <EmptyState icon={<Smile />} title="No kids added yet">
          Your activity provider adds your children when they enrol.
        </EmptyState>
      ) : (
        familyChildren(state).map((child) => (
          <Link
            key={child.slug}
            href={`/family/kids/${child.slug}`}
            className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)] transition hover:bg-white/70"
          >
            {child.progress !== null ? (
              <ProgressRing
                value={child.progress}
                size={72}
                stroke={8}
                className="shrink-0 text-cobalt [&_span]:text-base"
              />
            ) : (
              <span
                className={cn(
                  "grid size-[72px] shrink-0 place-items-center rounded-full font-display text-2xl font-semibold",
                  CHILD_FILL[child.colour],
                )}
              >
                {child.firstName.charAt(0)}
              </span>
            )}
            <div className="flex-1">
              <p className="font-display text-2xl font-semibold">{child.firstName}</p>
              <p className="text-muted">
                {child.level} · {child.schedule.day}s {child.schedule.time}
              </p>
            </div>
            <ArrowRight aria-hidden className="size-5 text-muted" />
          </Link>
        ))
      )}
    </div>
  );
}
