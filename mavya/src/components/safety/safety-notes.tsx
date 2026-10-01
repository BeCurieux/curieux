import { HeartPulse, ShieldAlert } from "lucide-react";
import { RESTRICTION_LABELS, type ChildSafety, type SafetyFlag } from "@/lib/domain/safety";
import { cn } from "@/lib/utils";

// A child's health notes and restriction warnings, as staff see them.
export function SafetyNotes({ safety, name }: { safety: ChildSafety; name: string }) {
  const { health, restrictions } = safety;
  if (!health && restrictions.length === 0) return null;
  return (
    <section aria-label="Health and safety" className="flex flex-col gap-3">
      {restrictions.map((r) => (
        <div
          key={r.id}
          role="note"
          className="flex items-start gap-3 rounded-lg border-2 border-[#9c3b29] bg-[#fff0ec] p-4 text-[#7a2c1f]"
        >
          <ShieldAlert aria-hidden className="mt-0.5 size-6 shrink-0" />
          <div>
            <p className="font-semibold">
              {RESTRICTION_LABELS[r.kind]}: {r.personName}
            </p>
            <p className="text-sm">
              {r.kind === "no_collect"
                ? `Don't hand ${name} over to ${r.personName}. If they come, keep ${name} with you and call the office.`
                : `${r.personName} must not contact ${name}. If they try, call the office.`}
            </p>
          </div>
        </div>
      ))}
      {health ? (
        <div className="flex items-start gap-3 rounded-lg bg-butter/60 p-4">
          <HeartPulse aria-hidden className="mt-0.5 size-6 shrink-0" />
          <dl className="flex flex-col gap-2">
            {health.allergies ? (
              <div>
                <dt className="font-semibold">Allergies</dt>
                <dd className="whitespace-pre-line">{health.allergies}</dd>
              </div>
            ) : null}
            {health.medicalNotes ? (
              <div>
                <dt className="font-semibold">Medical notes</dt>
                <dd className="whitespace-pre-line">{health.medicalNotes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

// "There's something to know", for lists. Never says what.
export function SafetyFlags({ flag, className }: { flag?: SafetyFlag; className?: string }) {
  if (!flag) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {flag.restriction ? (
        <span
          title="Pickup or contact restriction"
          className="inline-flex items-center gap-1 rounded-full bg-[#fff0ec] px-2 py-0.5 text-xs font-semibold text-[#9c3b29]"
        >
          <ShieldAlert aria-hidden className="size-3.5" />
          Restriction
        </span>
      ) : null}
      {flag.health ? (
        <span
          title="Health notes"
          className="inline-flex items-center gap-1 rounded-full bg-butter/70 px-2 py-0.5 text-xs font-semibold text-ink"
        >
          <HeartPulse aria-hidden className="size-3.5" />
          Health
        </span>
      ) : null}
    </span>
  );
}
