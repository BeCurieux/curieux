import { Check, Circle, CircleDashed } from "lucide-react";
import type { SkillStatus } from "@/lib/demo/data";
import { cn } from "@/lib/utils";

export const SKILL_LABEL: Record<SkillStatus, string> = {
  achieved: "Achieved",
  developing: "Developing",
  not_started: "Not started",
};

// Shape and text as well as colour, so status never relies on colour alone.
export function SkillBadge({ status, className }: { status: SkillStatus; className?: string }) {
  const Icon = status === "achieved" ? Check : status === "developing" ? CircleDashed : Circle;
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold [&_svg]:size-4",
        status === "achieved" && "bg-[#dcf1e7] text-[#23694c]",
        status === "developing" && "bg-[#fbeecb] text-[#7a5410]",
        status === "not_started" && "bg-surface-soft text-muted",
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2.75} />
      {SKILL_LABEL[status]}
    </span>
  );
}
