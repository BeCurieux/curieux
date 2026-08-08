"use client";

import { useState, useTransition } from "react";
import { submitCheckin } from "@/app/(product)/actions";
import { Button, Card, Chip, SectionLabel } from "@/components/ui";
import type { EnergyLevel, BudgetLevel, TimeLevel } from "@/lib/types";

/**
 * The weekly check-in (§10).
 *
 * Three taps, optional, under ten seconds. The card is explicit that skipping
 * it is fine, because the product’s promise is that it works without you —
 * a check-in that feels compulsory turns a weekly gift into a weekly chore.
 */
const ENERGY: Array<{ value: EnergyLevel; label: string }> = [
  { value: "LOW", label: "😴 Low" },
  { value: "NORMAL", label: "🙂 Normal" },
  { value: "HIGH", label: "🔥 Let’s go" },
];

const BUDGET: Array<{ value: BudgetLevel; label: string }> = [
  { value: "LOW", label: "$" },
  { value: "MEDIUM", label: "$$" },
  { value: "HIGH", label: "$$$" },
];

const TIME: Array<{ value: TimeLevel; label: string }> = [
  { value: "FEW_HOURS", label: "A few hours" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "WHOLE_DAY", label: "Whole day" },
];

export function CheckinCard({
  weekendDate,
  existing,
  hasPlan,
}: {
  weekendDate: string;
  existing: {
    energy: EnergyLevel | null;
    budget: BudgetLevel | null;
    time: TimeLevel | null;
    note: string | null;
  } | null;
  hasPlan: boolean;
}) {
  const [energy, setEnergy] = useState<EnergyLevel | null>(existing?.energy ?? null);
  const [budget, setBudget] = useState<BudgetLevel | null>(existing?.budget ?? null);
  const [time, setTime] = useState<TimeLevel | null>(existing?.time ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(existing?.note));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    energy !== (existing?.energy ?? null) ||
    budget !== (existing?.budget ?? null) ||
    time !== (existing?.time ?? null) ||
    note !== (existing?.note ?? "");

  function save() {
    startTransition(async () => {
      const result = await submitCheckin({
        energy,
        budget,
        time,
        note: note.trim() ? note.trim() : null,
      });
      setMessage(result.ok ? (result.message ?? "Saved.") : (result.error ?? "Couldn’t save"));
    });
  }

  return (
    <Card className="p-6">
      <SectionLabel>Anything different this weekend?</SectionLabel>
      <p className="mt-1.5 text-[15px] leading-relaxed text-graphite">
        Optional — we’ll plan around your usual if you skip it.
        {hasPlan ? " Changing this rebuilds your plan." : ""}
      </p>

      <div className="mt-5 space-y-4">
        <Row label="Energy">
          {ENERGY.map((option) => (
            <Chip
              key={option.value}
              selected={energy === option.value}
              onClick={() => setEnergy(energy === option.value ? null : option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </Row>

        <Row label="Budget">
          {BUDGET.map((option) => (
            <Chip
              key={option.value}
              selected={budget === option.value}
              onClick={() => setBudget(budget === option.value ? null : option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </Row>

        <Row label="Time">
          {TIME.map((option) => (
            <Chip
              key={option.value}
              selected={time === option.value}
              onClick={() => setTime(time === option.value ? null : option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </Row>
      </div>

      {showNote ? (
        <div className="mt-4">
          <label htmlFor="checkin-note" className="text-[14px] font-medium text-graphite">
            Anything we should know?
          </label>
          <input
            id="checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Grandparents visiting · no car · need to stay close"
            className="mt-1.5 h-12 w-full rounded-xl border border-rule bg-white px-4 text-[15px] text-ink placeholder:text-mist"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-4 text-[14px] text-mist underline-offset-4 hover:underline"
        >
          Something different this week?
        </button>
      )}

      {dirty ? (
        <div className="mt-5">
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}

      {message ? (
        <p aria-live="polite" className="mt-3 text-[14px] text-forest">
          {message}
        </p>
      ) : null}

      <input type="hidden" value={weekendDate} readOnly />
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium uppercase tracking-wide text-mist">{label}</p>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">{children}</div>
    </div>
  );
}
