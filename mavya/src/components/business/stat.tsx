import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// One number. With `href`, the whole card opens the records it counts.
export function Stat({
  label,
  value,
  suffix,
  tone = "plain",
  href,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "plain" | "attention";
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-md border border-line bg-surface p-4",
        tone === "attention" && "border-coral bg-[#fff4f1]",
        href && "transition hover:border-ink",
        className,
      )}
    >
      <dt className="text-sm font-semibold text-muted">
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 after:absolute after:inset-0 after:rounded-md hover:text-ink"
          >
            {label}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className="tabular font-display text-3xl font-semibold tracking-tight">
        {value}
        {suffix ? <span className="text-xl text-muted">{suffix}</span> : null}
      </dd>
    </div>
  );
}
