// Per-subject-type configuration.
//
// The engine is one engine. What changes between a child's year, a family's
// year and a grandparent's life is: what the book is called, which chapters
// are available, what "the little things" means, and how questions should be
// asked. All of that lives here, so a new product line is a config entry
// rather than a fork of the book generator.

import type { SectionType } from "@/lib/types";

export type SubjectType = "child" | "family" | "life";

/** How a book's time span is derived for this subject type. */
export type PeriodModel =
  | "year_of_life"   // anchored to a date of birth: age 2 → their third year
  | "calendar_year"  // Jan–Dec of a given year
  | "whole_life";    // everything, chaptered by era

export interface LittleThingCategory {
  value: string;
  label: string;
  placeholder: string;
}

export interface SubjectTypeConfig {
  type: SubjectType;
  /** What the product calls one of these, in the interface. */
  noun: string;
  /** Onboarding question, screen one. */
  onboardingPrompt: string;
  /** Heading for the little-things capture flow. */
  littleThingsPrompt: string;
  periodModel: PeriodModel;
  /** Sections the structure generator may propose for this type. */
  allowedSections: SectionType[];
  littleThingCategories: LittleThingCategory[];
  /** Injected into the question-engine prompt. */
  questionGuidance: string;
  /** Injected into the copy-drafting prompt. */
  voiceGuidance: string;
}

// The colour system runs to eighteen, so the words have to as well. Stopping
// at ten meant a cover reading FLORENCE / ELEVEN fell back to FLORENCE / 11 —
// a numeral set at 96pt where every earlier volume in the row has a word. The
// shelf is the product; it cannot change convention halfway along.
const YEAR_WORDS: Record<number, string> = {
  // Birth to the first birthday. "The Year You Were Born" is the sentence the
  // title template already wants; "The Year You Were 0" is what it printed.
  0: "Born",
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
  6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
  11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen",
  15: "Fifteen", 16: "Sixteen", 17: "Seventeen", 18: "Eighteen",
};

export function yearWord(year: number): string {
  return YEAR_WORDS[year] ?? String(year);
}

export const CHILD: SubjectTypeConfig = {
  type: "child",
  noun: "child",
  onboardingPrompt: "Whose childhood are we keeping?",
  littleThingsPrompt: "Right now…",
  periodModel: "year_of_life",
  allowedSections: [
    "opening", "people", "theme", "trip", "quotes",
    "little_things", "ordinary_days", "month", "change_over_time", "closing",
  ],
  littleThingCategories: [
    { value: "current_obsession", label: "they're obsessed with", placeholder: "garbage trucks — knows the whole Tuesday route" },
    { value: "funny_word",        label: "something funny they say", placeholder: "“my byself”" },
    { value: "favourite_food",    label: "favourite food", placeholder: "strawberries, checked personally before eating" },
    { value: "comfort_object",    label: "comfort object", placeholder: "Bun Bun, a blue rabbit, goes everywhere" },
    { value: "favourite_person",  label: "favourite person", placeholder: "Grandpa on Thursdays" },
    { value: "bedtime_ritual",    label: "bedtime demand", placeholder: "exactly three songs, counted on fingers" },
    { value: "current_song",      label: "the song", placeholder: "the one from the car, on repeat" },
    { value: "current_belief",    label: "a funny belief", placeholder: "the moon has gone to work" },
    { value: "phrase",            label: "the phrase", placeholder: "I do it!" },
  ],
  questionGuidance:
    `Ask the parent about patterns you can see but cannot explain: a recurring
object, a person who appears on the same day each week, an activity that
changes across the year, or something that looks like a first and needs
confirming. Never ask them to reminisce in general.`,
  voiceGuidance:
    `Address the child as "you" — the book is written to them. Keep sentences
short and concrete. The parent's own wording is always better than yours.`,
};

export const FAMILY: SubjectTypeConfig = {
  type: "family",
  noun: "family",
  onboardingPrompt: "Whose year are we keeping?",
  littleThingsPrompt: "In this house, right now…",
  periodModel: "calendar_year",
  allowedSections: [
    "opening", "people", "theme", "trip", "quotes",
    "little_things", "ordinary_days", "month", "closing",
  ],
  littleThingCategories: [
    { value: "running_joke",    label: "the running joke", placeholder: "nobody is allowed to mention the tent" },
    { value: "weekly_ritual",   label: "the weekly ritual", placeholder: "Friday night is pizza and nobody argues" },
    { value: "dinner_on_repeat",label: "dinner on repeat", placeholder: "the same pasta, four nights a week" },
    { value: "car_song",        label: "the song in the car", placeholder: "everyone knows the second verse now" },
    { value: "on_the_fridge",   label: "what's on the fridge", placeholder: "a drawing of the dog, allegedly" },
    { value: "household_rule",  label: "the house rule", placeholder: "shoes off, no exceptions, ignored daily" },
    { value: "current_project", label: "the unfinished project", placeholder: "the deck, since March" },
  ],
  questionGuidance:
    `Ask about rituals and patterns that involve more than one person: a
recurring weekend, a trip everyone remembers differently, a change in the
household across the year. Prefer questions whose answers include more than
one family member.`,
  voiceGuidance:
    `Write in the first person plural — "we", "our year". Avoid singling out
one person as the protagonist unless the memories clearly do.`,
};

export const LIFE: SubjectTypeConfig = {
  type: "life",
  noun: "life story",
  onboardingPrompt: "Whose life are we keeping?",
  littleThingsPrompt: "The things they always…",
  periodModel: "whole_life",
  allowedSections: [
    "opening", "era", "people", "theme", "trip", "quotes",
    "little_things", "change_over_time", "closing",
  ],
  littleThingCategories: [
    { value: "saying",      label: "a saying of theirs", placeholder: "“you'll be right”" },
    { value: "habit",       label: "a habit", placeholder: "tea at exactly four o'clock" },
    { value: "recipe",      label: "a recipe", placeholder: "the fruit cake, never written down" },
    { value: "advice",      label: "advice they gave", placeholder: "never buy cheap shoes or a cheap bed" },
    { value: "superstition",label: "a superstition", placeholder: "never put new shoes on the table" },
    { value: "always_wore", label: "what they always wore", placeholder: "the brown cardigan, both elbows gone" },
    { value: "song",        label: "their song", placeholder: "sung in the kitchen, badly, for fifty years" },
  ],
  questionGuidance:
    `You are helping someone record another person's life, usually a parent or
grandparent. Ask about a specific photograph: who is in it, where it was,
what happened just after. Ask about gaps in the chronology you can see —
a decade with no photographs, a place that appears once. Never assume a
relationship, a date, an occupation or an outcome. The person telling the
story is the only authority.`,
  voiceGuidance:
    `Where a transcript exists, the subject's own words are the content — quote
them, do not paraphrase. Write around their voice, never over it. Third
person for narration, first person for anything they said.`,
};

export const SUBJECT_TYPES: Record<SubjectType, SubjectTypeConfig> = {
  child: CHILD,
  family: FAMILY,
  life: LIFE,
};

export function configFor(type: SubjectType): SubjectTypeConfig {
  const config = SUBJECT_TYPES[type];
  if (!config) throw new Error(`unknown subject type: ${type}`);
  return config;
}

export interface TitleInput {
  displayName: string;
  /** Years of life completed — child only. */
  yearNumber?: number | null;
  /** Calendar year — family only. */
  calendarYear?: number | null;
}

/** The book's title for a given subject type. */
export function titleFor(type: SubjectType, input: TitleInput): string {
  switch (type) {
    case "child":
      return `The Year You Were ${yearWord(input.yearNumber ?? 1)}`;
    case "family":
      return input.calendarYear ? `Our Year, ${input.calendarYear}` : "Our Year";
    case "life":
      return `The Life of ${input.displayName}`;
  }
}

/** The book's subtitle, or null where the title stands alone. */
export function subtitleFor(type: SubjectType, input: TitleInput): string | null {
  switch (type) {
    case "child":  return input.displayName;
    case "family": return input.displayName;
    case "life":   return null;
  }
}

/** Whether the structure generator may propose a section for this type. */
export function allowsSection(type: SubjectType, section: SectionType): boolean {
  return configFor(type).allowedSections.includes(section);
}
