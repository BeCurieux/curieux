import type { ReactNode } from "react";
import {
  balanceWords,
  formatMoney,
  KIND_LABELS,
  METHOD_LABELS,
  type AccountLine,
} from "@/lib/domain/accounts";
import { cn } from "@/lib/utils";

// A family's account, as owners and parents see it (M7a): the balance, then
// every line, newest first. Cancelled lines stay visible, struck through.

export function Balance({ cents, className }: { cents: number; className?: string }) {
  return (
    <p
      className={cn(
        "font-display text-3xl font-semibold tracking-tight",
        cents > 0 ? "text-ink" : "text-[#23694c]",
        className,
      )}
    >
      {balanceWords(cents)}
    </p>
  );
}

const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));

function detail(line: AccountLine, childName: (id: string | null) => string | null): string {
  const parts: string[] = [KIND_LABELS[line.kind]];
  const who = childName(line.childId);
  if (who) parts.push(who);
  if (line.lessons && line.unitCents != null)
    parts.push(`${line.lessons} lessons × ${formatMoney(line.unitCents)}`);
  if (line.method) parts.push(METHOD_LABELS[line.method]);
  parts.push(shortDay(line.paidOn ? `${line.paidOn}T12:00:00Z` : line.createdAt));
  return parts.join(" · ");
}

export function Statement({
  lines,
  childName = () => null,
  action,
}: {
  lines: AccountLine[];
  childName?: (id: string | null) => string | null;
  action?: (line: AccountLine) => ReactNode;
}) {
  if (lines.length === 0) return <p className="text-muted">Nothing on the account yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {lines.map((line) => (
        <li key={line.id} className="flex flex-col gap-2 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className={cn("min-w-0", line.cancelled && "text-muted line-through")}>
              <p className="font-semibold">{line.description}</p>
              <p className="text-sm text-muted">{detail(line, childName)}</p>
            </div>
            <p
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                line.amountCents < 0 && "text-[#23694c]",
                line.cancelled && "text-muted line-through",
              )}
            >
              {line.amountCents < 0
                ? `−${formatMoney(-line.amountCents)}`
                : formatMoney(line.amountCents)}
            </p>
          </div>
          {action && !line.cancelled && !line.online && line.kind !== "cancellation"
            ? action(line)
            : null}
        </li>
      ))}
    </ul>
  );
}
