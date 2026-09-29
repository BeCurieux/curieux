import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  suffix,
  tone = "plain",
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "plain" | "attention";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-line bg-surface p-4",
        tone === "attention" && "border-coral bg-[#fff4f1]",
        className,
      )}
    >
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="tabular font-display text-3xl font-semibold tracking-tight">
        {value}
        {suffix ? <span className="text-xl text-muted">{suffix}</span> : null}
      </dd>
    </div>
  );
}
