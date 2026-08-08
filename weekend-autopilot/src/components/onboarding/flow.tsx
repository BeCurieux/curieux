"use client";

/**
 * Onboarding (§9).
 *
 * Ten screens, target two to four minutes, chips rather than forms. State is
 * held in the client and submitted once at the end, so an abandoned setup
 * leaves nothing behind and the confirmation screen can summarise a complete
 * picture.
 *
 * Two design decisions worth defending:
 *
 *  - Screen 5 asks what you do AND what you’d like to do, as separate
 *    questions with a consent step between them. That gap is the "wannabe
 *    active" user the brief names as a core segment, and collapsing it into
 *    one question loses them.
 *  - Children get an age and, optionally, a nickname. Nothing else, and the
 *    screen says so — a parent deciding whether to trust us with their family’s
 *    weekends is reading that screen carefully.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BrandLogo,
  Button,
  Chip,
  ChoiceCard,
  ProgressBar,
  SectionLabel,
} from "@/components/ui";
import { CATEGORIES, CUISINES, DIETARY_REQUIREMENTS, DISLIKES } from "@/config/taxonomy";
import { searchSuburbs, type SuburbEntry } from "@/lib/sydney-suburbs";
import { completeOnboarding, type OnboardingInput } from "@/app/onboarding/actions";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import type { HouseholdShape, MemberType } from "@/lib/types";

const TOTAL_STEPS = 10;

interface DraftMember {
  member_type: MemberType;
  nickname: string | null;
  age: number | null;
  mobility_notes: string | null;
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outsideMarket, setOutsideMarket] = useState(false);

  // ---------------------------------------------------------------- state
  const [suburb, setSuburb] = useState<SuburbEntry | null>(null);
  const [suburbQuery, setSuburbQuery] = useState("");

  const [shape, setShape] = useState<HouseholdShape>("COUPLE");
  const [members, setMembers] = useState<DraftMember[]>([]);

  const [travel, setTravel] = useState(40);
  const [occasionallyFurther, setOccasionallyFurther] = useState(false);
  const [transport, setTransport] = useState<string[]>(["DRIVING", "WALKING"]);

  const [budget, setBudget] = useState("UNDER_75");

  const [activity, setActivity] = useState("EASY");
  const [desired, setDesired] = useState("EASY");
  const [nudge, setNudge] = useState("NONE");

  const [liked, setLiked] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [hardNo, setHardNo] = useState("");

  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [coffeeMatters, setCoffeeMatters] = useState(false);
  const [kidFriendlyMatters, setKidFriendlyMatters] = useState(false);
  const [priceSensitive, setPriceSensitive] = useState(false);

  const [startTime, setStartTime] = useState("AROUND_9");
  const [timeBudget, setTimeBudget] = useState("HALF_DAY");

  const hasChildren = shape === "FAMILY";
  const suggestions = useMemo(() => searchSuburbs(suburbQuery), [suburbQuery]);

  const draft: OnboardingInput | null = suburb
    ? {
        home_label: suburb.name,
        home_lat: suburb.lat,
        home_lng: suburb.lng,
        shape,
        members: members.length > 0 ? members : defaultMembers(shape),
        max_travel_minutes: travel,
        allow_occasional_further: occasionallyFurther,
        transport_modes: transport as OnboardingInput["transport_modes"],
        budget_band: budget as OnboardingInput["budget_band"],
        activity_level: activity as OnboardingInput["activity_level"],
        desired_activity_level: desired as OnboardingInput["desired_activity_level"],
        nudge: nudge as OnboardingInput["nudge"],
        liked_categories: liked,
        dislikes,
        hard_no: hardNo.trim() ? hardNo.trim() : null,
        food: {
          cuisines_loved: cuisines,
          dietary_requirements: dietary,
          kid_friendly_importance: kidFriendlyMatters ? 0.9 : hasChildren ? 0.5 : 0,
          coffee_importance: coffeeMatters ? 0.9 : 0.4,
          restaurant_price_sensitivity: priceSensitive ? 0.85 : 0.4,
        },
        start_time_preference: startTime as OnboardingInput["start_time_preference"],
        time_budget: timeBudget as OnboardingInput["time_budget"],
        // Derived rather than asked: nobody answers "rate your crowd tolerance
        // from zero to one", but ticking "crowds" under dislikes says it
        // perfectly well.
        crowd_tolerance: dislikes.includes("crowds") ? 0.2 : 0.55,
      }
    : null;

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit() {
    if (!draft) return;
    setSubmitting(true);
    setError(null);

    const result = await completeOnboarding(draft);
    if (result.outsideMarket) {
      setOutsideMarket(true);
      setSubmitting(false);
      return;
    }
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }
    router.push("/app");
  }

  if (outsideMarket) {
    return (
      <Shell step={TOTAL_STEPS}>
        <h1 className="text-[30px] leading-tight text-ink">Not in your city yet.</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-graphite">
          We only plan weekends in Sydney today. Tell us where you are and we’ll let you
          know when we get there.
        </p>
        <div className="mt-6">
          <WaitlistForm />
        </div>
      </Shell>
    );
  }

  const canContinue = step !== 1 || suburb !== null;

  return (
    <Shell step={step}>
      {/* ------------------------------------------------------- 1: where */}
      {step === 1 ? (
        <Screen
          title="Where do your weekends start?"
          subtitle="Your suburb is enough. We use it to work out travel time — we don’t track your location."
        >
          <input
            value={suburb ? suburb.name : suburbQuery}
            onChange={(e) => {
              setSuburb(null);
              setSuburbQuery(e.target.value);
            }}
            placeholder="Suburb or postcode"
            className="h-14 w-full rounded-xl border border-rule bg-white px-4 text-[17px] text-ink placeholder:text-mist"
          />
          {!suburb && suggestions.length > 0 ? (
            <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-white">
              {suggestions.map((entry) => (
                <li key={entry.postcode + entry.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setSuburb(entry);
                      setSuburbQuery(entry.name);
                    }}
                    className="flex w-full items-baseline justify-between px-4 py-3 text-left hover:bg-paper"
                  >
                    <span className="text-[16px] text-ink">{entry.name}</span>
                    <span className="text-[14px] text-mist">{entry.postcode}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {suburb ? (
            <p className="mt-3 text-[15px] text-forest">
              {suburb.name} it is. You can change this any time.
            </p>
          ) : null}
        </Screen>
      ) : null}

      {/* ------------------------------------------------- 2: who it’s for */}
      {step === 2 ? (
        <Screen title="Who are weekends usually for?">
          <div className="space-y-2.5">
            {(
              [
                ["SOLO", "Just me", null],
                ["COUPLE", "Me and my partner", null],
                ["FAMILY", "Family", "We’ll ask about ages next"],
                ["FRIENDS", "Friends, or it varies", null],
              ] as const
            ).map(([value, label, hint]) => (
              <ChoiceCard
                key={value}
                title={label}
                description={hint ?? undefined}
                selected={shape === value}
                onClick={() => {
                  setShape(value);
                  setMembers(defaultMembers(value));
                }}
              />
            ))}
          </div>

          {hasChildren ? (
            <div className="mt-6">
              <SectionLabel>Children</SectionLabel>
              <p className="mt-1.5 text-[15px] leading-relaxed text-graphite">
                An age is all we need. A three-year-old and a nine-year-old want completely
                different Saturdays. A nickname is optional; we ask for nothing else.
              </p>
              <ChildEditor members={members} onChange={setMembers} />
            </div>
          ) : null}
        </Screen>
      ) : null}

      {/* --------------------------------------------------- 3: how far */}
      {step === 3 ? (
        <Screen title="How far will you go?" subtitle="Door to door, one way.">
          <div className="flex flex-wrap gap-2">
            {[20, 40, 60, 90].map((minutes) => (
              <Chip key={minutes} selected={travel === minutes} onClick={() => setTravel(minutes)}>
                {minutes} minutes
              </Chip>
            ))}
          </div>

          <div className="mt-4">
            <Chip
              selected={occasionallyFurther}
              onClick={() => setOccasionallyFurther(!occasionallyFurther)}
            >
              Surprise me occasionally
            </Chip>
          </div>

          <div className="mt-8">
            <SectionLabel>How do you get around?</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["DRIVING", "Car"],
                  ["TRANSIT", "Public transport"],
                  ["WALKING", "Walking"],
                  ["CYCLING", "Cycling"],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  selected={transport.includes(value)}
                  onClick={() => toggle(transport, value, setTransport)}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </Screen>
      ) : null}

      {/* ---------------------------------------------------- 4: budget */}
      {step === 4 ? (
        <Screen
          title="What does a good weekend cost?"
          subtitle="Total for everyone, not per person. Plenty of the best plans cost nothing."
        >
          <div className="space-y-2.5">
            {(
              [
                ["FREE", "Mostly free"],
                ["UNDER_75", "Under A$75"],
                ["75_150", "A$75–150"],
                ["150_250", "A$150–250"],
                ["FLEXIBLE", "Flexible — worth spending occasionally"],
              ] as const
            ).map(([value, label]) => (
              <ChoiceCard
                key={value}
                title={label}
                selected={budget === value}
                onClick={() => setBudget(value)}
              />
            ))}
          </div>
        </Screen>
      ) : null}

      {/* -------------------------------------------------- 5: activity */}
      {step === 5 ? (
        <Screen title="How active are you, honestly?">
          <div className="space-y-2.5">
            {ACTIVITY_OPTIONS.map(([value, label]) => (
              <ChoiceCard
                key={value}
                title={label}
                selected={activity === value}
                onClick={() => {
                  setActivity(value);
                  // Sensible default: most people want a bit more than they do.
                  if (desired === activity) setDesired(value);
                }}
              />
            ))}
          </div>

          <div className="mt-8">
            <SectionLabel>And how active would you like to be?</SectionLabel>
            <div className="mt-3 space-y-2.5">
              {ACTIVITY_OPTIONS.map(([value, label]) => (
                <ChoiceCard
                  key={value}
                  title={label}
                  selected={desired === value}
                  onClick={() => setDesired(value)}
                />
              ))}
            </div>
          </div>

          {desired !== activity ? (
            <div className="mt-8">
              <SectionLabel>Want us to nudge you?</SectionLabel>
              <div className="mt-3 space-y-2.5">
                {(
                  [
                    ["NONE", "No — meet me where I am", null],
                    ["LITTLE", "A little", "One step further, now and then"],
                    ["YES", "Yes — get me moving", "We’ll push toward what you said you wanted"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <ChoiceCard
                    key={value}
                    title={label}
                    description={hint ?? undefined}
                    selected={nudge === value}
                    onClick={() => setNudge(value)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </Screen>
      ) : null}

      {/* ------------------------------------------------ 6: what’s good */}
      {step === 6 ? (
        <Screen
          title="What sounds good?"
          subtitle="Pick as many as you like. We’ll learn the rest from what you actually do."
        >
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
        </Screen>
      ) : null}

      {/* --------------------------------------------------- 7: dislikes */}
      {step === 7 ? (
        <Screen title="And what would spoil it?">
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

          <div className="mt-8">
            <SectionLabel>Absolutely not</SectionLabel>
            <input
              value={hardNo}
              onChange={(e) => setHardNo(e.target.value)}
              maxLength={200}
              placeholder="Anything we should never suggest"
              className="mt-3 h-14 w-full rounded-xl border border-rule bg-white px-4 text-[17px] text-ink placeholder:text-mist"
            />
          </div>
        </Screen>
      ) : null}

      {/* ------------------------------------------------------- 8: food */}
      {step === 8 ? (
        <Screen title="Food" subtitle="Most good weekends are built around a meal.">
          <SectionLabel>Cuisines you love</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => (
              <Chip
                key={cuisine}
                selected={cuisines.includes(cuisine)}
                onClick={() => toggle(cuisines, cuisine, setCuisines)}
              >
                {cuisine}
              </Chip>
            ))}
          </div>

          <div className="mt-7">
            <SectionLabel>Anything we need to work around?</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETARY_REQUIREMENTS.map((requirement) => (
                <Chip
                  key={requirement}
                  selected={dietary.includes(requirement)}
                  onClick={() => toggle(dietary, requirement, setDietary)}
                >
                  {requirement.replace(/_/g, " ")}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-7 space-y-2.5">
            <ChoiceCard
              title="Good coffee matters"
              selected={coffeeMatters}
              onClick={() => setCoffeeMatters(!coffeeMatters)}
            />
            {hasChildren ? (
              <ChoiceCard
                title="It needs to work with the kids"
                selected={kidFriendlyMatters}
                onClick={() => setKidFriendlyMatters(!kidFriendlyMatters)}
              />
            ) : null}
            <ChoiceCard
              title="Keep restaurants cheap"
              description="We’ll spend the budget on the doing rather than the eating"
              selected={priceSensitive}
              onClick={() => setPriceSensitive(!priceSensitive)}
            />
          </div>
        </Screen>
      ) : null}

      {/* ----------------------------------------------------- 9: timing */}
      {step === 9 ? (
        <Screen title="When does your weekend start?">
          <div className="space-y-2.5">
            {(
              [
                ["EARLY", "Early — before eight"],
                ["AROUND_9", "Around nine"],
                ["AROUND_10", "Around ten"],
                ["LATE_MORNING", "Late morning"],
                ["FLEXIBLE", "Depends on the week"],
              ] as const
            ).map(([value, label]) => (
              <ChoiceCard
                key={value}
                title={label}
                selected={startTime === value}
                onClick={() => setStartTime(value)}
              />
            ))}
          </div>

          <div className="mt-8">
            <SectionLabel>And how much of the day is usually free?</SectionLabel>
            <div className="mt-3 space-y-2.5">
              {(
                [
                  ["FEW_HOURS", "Two or three hours"],
                  ["HALF_DAY", "Half a day"],
                  ["MOST_OF_DAY", "Most of the day"],
                  ["FULL_WEEKEND", "The whole weekend"],
                ] as const
              ).map(([value, label]) => (
                <ChoiceCard
                  key={value}
                  title={label}
                  selected={timeBudget === value}
                  onClick={() => setTimeBudget(value)}
                />
              ))}
            </div>
          </div>
        </Screen>
      ) : null}

      {/* ------------------------------------------------ 10: confirmation */}
      {step === 10 && draft ? (
        <Screen title="We’ve got you.">
          <div className="rounded-card border border-rule bg-white p-6">
            <p className="font-display text-[19px] leading-relaxed text-ink">
              {localSummary(draft)}
            </p>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-graphite">
            Anything not quite right? Go back and change it — or edit it later in preferences,
            any time.
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-mist">
            Your first plan is being built now. It lands in your inbox on Thursday morning.
          </p>
        </Screen>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 text-[15px] text-clay">
          {error}
        </p>
      ) : null}

      {/* --------------------------------------------------------- footer */}
      <div className="mt-10 flex items-center gap-3">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={submitting}>
            Back
          </Button>
        ) : null}

        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canContinue} block={step === 1}>
            Continue
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting} block>
            {submitting ? "Setting up…" : "Start my weekends"}
          </Button>
        )}
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------ pieces

const ACTIVITY_OPTIONS = [
  ["GENTLE", "Keep it gentle"],
  ["EASY", "Happy walking a few kilometres"],
  ["MODERATE", "Moderately active"],
  ["ACTIVE", "Very active"],
] as const;

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto max-w-lg px-5 py-8">
        <div className="flex items-center justify-between">
          <BrandLogo href={null} />
          <span className="text-[13px] text-mist">
            {step} of {TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-4">
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>
        <div className="mt-10 pb-16">{children}</div>
      </div>
    </div>
  );
}

function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[30px] leading-[1.12] text-ink">{title}</h1>
      {subtitle ? (
        <p className="mt-3 text-[16px] leading-relaxed text-graphite">{subtitle}</p>
      ) : null}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ChildEditor({
  members,
  onChange,
}: {
  members: DraftMember[];
  onChange: (next: DraftMember[]) => void;
}) {
  const children = members.filter((m) => m.member_type === "CHILD");
  const adults = members.filter((m) => m.member_type === "ADULT");

  function update(index: number, patch: Partial<DraftMember>) {
    const next = [...children];
    const existing = next[index];
    if (!existing) return;
    next[index] = { ...existing, ...patch };
    onChange([...adults, ...next]);
  }

  return (
    <div className="mt-4 space-y-3">
      {children.map((child, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={child.nickname ?? ""}
            onChange={(e) => update(index, { nickname: e.target.value || null })}
            placeholder="Nickname (optional)"
            maxLength={40}
            className="h-12 flex-1 rounded-xl border border-rule bg-white px-4 text-[16px] text-ink placeholder:text-mist"
          />
          <input
            type="number"
            min={0}
            max={19}
            value={child.age ?? ""}
            onChange={(e) =>
              update(index, { age: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="Age"
            className="h-12 w-24 rounded-xl border border-rule bg-white px-4 text-[16px] text-ink placeholder:text-mist"
          />
          <button
            type="button"
            aria-label="Remove child"
            onClick={() => onChange([...adults, ...children.filter((_, i) => i !== index)])}
            className="h-12 w-12 shrink-0 rounded-xl border border-rule bg-white text-mist hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...members,
            { member_type: "CHILD", nickname: null, age: null, mobility_notes: null },
          ])
        }
        className="text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
      >
        + Add a child
      </button>
    </div>
  );
}

function defaultMembers(shape: HouseholdShape): DraftMember[] {
  const adult = (): DraftMember => ({
    member_type: "ADULT",
    nickname: null,
    age: null,
    mobility_notes: null,
  });

  switch (shape) {
    case "SOLO":
      return [adult()];
    case "COUPLE":
      return [adult(), adult()];
    case "FAMILY":
      return [adult(), adult()];
    case "FRIENDS":
      return [adult(), adult()];
  }
}

/**
 * The confirmation summary, computed locally.
 *
 * The AI writes a nicer version of this in the real flow, but the screen must
 * never sit waiting on a model call — so the local version is what renders,
 * immediately, and it is honest about the same facts.
 */
function localSummary(draft: OnboardingInput): string {
  const likes = draft.liked_categories
    .slice(0, 3)
    .map((id) => CATEGORIES.find((c) => c.id === id)?.label.toLowerCase())
    .filter(Boolean)
    .join(", ");

  const budgetPhrase: Record<string, string> = {
    FREE: "Usually free",
    UNDER_75: "Usually under A$75",
    "75_150": "Usually A$75–150",
    "150_250": "Usually A$150–250",
    FLEXIBLE: "Flexible about spending",
  };

  const activityPhrase: Record<string, string> = {
    GENTLE: "Gentle rather than strenuous",
    EASY: "Active, but not 'up at six for a 17 km hike' active",
    MODERATE: "Moderately active",
    ACTIVE: "Genuinely active",
  };

  const children = draft.members.filter((m) => m.member_type === "CHILD" && m.age !== null);
  const childPhrase =
    children.length > 0
      ? ` Built around ${children.length === 1 ? "a" : ""} ${children
          .map((c) => `${c.age}-year-old`)
          .join(" and ")}.`
      : "";

  return (
    `${likes ? capitalise(likes) + ". " : ""}` +
    `${budgetPhrase[draft.budget_band] ?? ""}. ` +
    `Happy to travel about ${draft.max_travel_minutes} minutes. ` +
    `${activityPhrase[draft.activity_level] ?? ""}.${childPhrase}`
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
