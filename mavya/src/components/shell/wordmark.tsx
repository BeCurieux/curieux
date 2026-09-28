import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-2xl font-semibold tracking-tight",
        className,
      )}
    >
      <span aria-hidden className="flex gap-0.5">
        <span className="size-2.5 rounded-full bg-coral" />
        <span className="size-2.5 rounded-full bg-lilac" />
        <span className="size-2.5 rounded-full bg-mint" />
      </span>
      mavya
    </span>
  );
}
