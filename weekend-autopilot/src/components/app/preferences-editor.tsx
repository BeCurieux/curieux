"use client";

import { useState, useTransition } from "react";
import { updatePreferences } from "@/app/(product)/actions";
import { Button, Card, Chip, SectionLabel } from "@/components/ui";
import { CATEGORIES, DISLIKES, category } from "@/config/taxonomy";
import type { BudgetBand, PreferenceProfile, TasteSignal } from "@/lib/types";

const TRAVEL_OPTIONS = [20, 40, 60, 90];

const BUDGETS: Array<{ value: BudgetBand; label: string }> = [
  { value: "FREE", label: "Mostly free" },
  { value: "UNDER_75", label: "Under A$75" },
  { value: "75_150", label: "A$75–150" },
  { value: "150_250", label: "A$150–250" },
  { value: "FLEXIBLE", label: "Flexible" },
];

const ACTIVITY = [
  { value: "GENTLE", label: "Keep it gentle" },
  { value: "EASY", label: "Happy walking a few km" },
  { value: "MODERATE", label: "Moderately active" },
  { value: "ACTIVE", label: "Very active" },
] as const;

const NUDGE = [
  { value: "NONE", label: "Meet me where I am" },
  { value: "LITTLE", label: "A little" },
  { value: "YES", label: "Get me moving" },
] as const;

export function PreferencesEditor({
  preferences,
  learned,
}: {
  preferences: PreferenceProfile;
  learned: TasteSignal[];
}) {
  const [travel, setTravel] = useState(preferences.max_travel_minutes);
  const [budget, setBudget] = useState<BudgetBand>(preferences.budget_band);
  const [activity, setActivity] = useState(preferences.activity_level);
  const [desired, setDesired] = useState(preferences.desired_activity_level);
  const [nudge, setNudge] = useState(preferences.nudge);
  const [liked, setLiked] = useState<string[]>(preferences.liked_categories);
  const [dislikes, setDislikes] = useState<string[]>(preferences.dislikes);
  const [hardNo, setHardNo] = useState(preferences.hard_no ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function save() {
    startTransition(async () => {
      const result = await updatePreferences({
        max_travel_minutes: travel,
        budget_band: budget,
        activity_level: activity,
        desired_activity_level: desired,
        nudge,
        liked_categories: liked,
        dislikes,
        hard_no: hardNo.trim() ? hardNo.trim() : null,
      });
      setMessage(result.ok ? (result.message ?? "Saved.") : (result.error ?? "Couldn’t save"));
    });
  }

  // Signals learned from behaviour that disagree with the stated selection —
  // shown rather than hidden (§18: behaviour outweighs what you said, and you
  // should be able to see when that has happened).
  const overrides = learned.filter(
    (s) =>
      s.dimension === "category" &&
      s.confidence >= 0.5 &&
      ((s.weight <= -0.5 && liked.includes(s.value)) ||
        (s.weight >= 0.6 && !liked.includes(s.value)))
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-6 p-6">
        <Field label="How far will you travel?">
          <div className="flex flex-wrap gap-2">
            {TRAVEL_OPTIONS.map((minutes) => (
              <Chip key={minutes} selected={travel === minutes} onClick={() => setTravel(minutes)}>
                {minutes} minutes
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Weekend budget" hint="Total for the household, not per person.">
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((option) => (
              <Chip
                key={option.value}
                selected={budget === option.value}
                onClick={() => setBudget(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="How active are you now?">
          <div className="flex flex-wrap gap-2">
            {ACTIVITY.map((option) => (
              <Chip
                key={option.value}
                selected={activity === option.value}
                onClick={() => setActivity(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label="How active would you like to be?"
          hint="The gap between these two is what we nudge toward."
        >
          <div className="flex flex-wrap gap-2">
            {ACTIVITY.map((option) => (
              <Chip
                key={option.value}
                selected={desired === option.value}
                onClick={() => setDesired(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Want us to nudge you?">
          <div className="flex flex-wrap gap-2">
            {NUDGE.map((option) => (
              <Chip
                key={option.value}
                selected={nudge === option.value}
                onClick={() => setNudge(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="space-y-6 p-6">
        <Field label="What sounds good?">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                selected={liked.includes(c.id)}
                onClick={() => toggle(liked, c.id, setLiked)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Things you’d rather avoid">
          <div className="flex flex-wrap gap-2">
            {DISLIKES.map((d) => (
              <Chip
                key={d.id}
                selected={dislikes.includes(d.id)}
                onClick={() => toggle(dislikes, d.id, setDislikes)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Absolutely not" hint="Anything we should never suggest.">
          <input
            value={hardNo}
            onChange={(e) => setHardNo(e.target.value)}
            maxLength={200}
            placeholder="e.g. anything with a queue"
            className="h-12 w-full rounded-xl border border-rule bg-white px-4 text-[15px] text-ink placeholder:text-mist"
          />
        </Field>
      </Card>

      {overrides.length > 0 ? (
        <Card className="bg-sage/50 p-6">
          <SectionLabel>What your weekends actually say</SectionLabel>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-graphite">
            {overrides.map((signal) => {
              const label = category(signal.value)?.label ?? signal.value;
              return (
                <li key={signal.id}>
                  {signal.weight < 0
                    ? `You picked ${label}, but you’ve turned these down. We’ve eased off.`
                    : `You didn’t pick ${label}, but you keep doing them. We’ve been including a few.`}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[14px] text-mist">
            Changing your selections above resets this.
          </p>
        </Card>
      ) : null}

      <div className="flex items-center gap-4">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {message ? (
          <span aria-live="polite" className="text-[14px] text-forest">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-ink">{label}</p>
      {hint ? <p className="mt-0.5 text-[14px] text-mist">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}
