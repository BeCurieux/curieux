// Asking one good question.
//
// "Add a memory!" is the nudge every app sends and nobody answers. What
// works is a question only this family could be asked — and the material to
// build one is already in the archive: what they last wrote about, which
// month is empty, which little thing was recorded six months ago and has
// certainly changed.
//
// One rule governs the whole module, and it is the same rule as the book's:
// **every prompt is built from something in the archive, never from
// something we imagine.** Asking "how's swimming going?" of a family who
// never mentioned swimming is the nudge equivalent of inventing a memory,
// and it would tell the parent instantly that nobody is really reading.
// Where there is nothing specific to ask, the engine says so and falls back
// to a general question rather than fabricating a detail.
//
// Pure and synchronous, so every branch is testable without a database.

export type PromptKind =
  | "gone_quiet"
  | "stale_little_thing"
  | "empty_month"
  | "no_voice_yet"
  | "no_quotes_lately"
  | "general";

export interface Prompt {
  kind: PromptKind;
  /** The question, already written out for this family. Shown in the app. */
  question: string;
  /**
   * The same question with nothing from the archive quoted in it.
   *
   * Two rules collide here and privacy wins. A good prompt quotes what the
   * family wrote — "you wrote 'Strawberries. Constantly.' — still true?" —
   * but an email must never carry the archive, because it passes through a
   * third party and sits in an inbox for ever. So the email points at the
   * thing and the app shows it. Where the question quotes nothing, this is
   * simply the same string.
   */
  emailQuestion: string;
  /** What in the archive produced it. Shown as "why am I being asked this?" */
  because: string;
  /** Same rule: the reason, with nothing quoted. */
  emailBecause: string;
  /** Higher wins. */
  weight: number;
}

export interface ArchiveState {
  childName: string;
  /** Days since anything at all was added. */
  daysSinceLastMemory: number | null;
  /** Titles of clusters the family has confirmed matter, most recent first. */
  recentThreads: string[];
  /** Little things, with how long ago each was recorded. */
  littleThings: { category: string; value: string; daysOld: number }[];
  /** Months of the current year with nothing in them, as names. */
  emptyMonths: string[];
  hasVoiceRecording: boolean;
  daysSinceLastQuote: number | null;
  /** How far through the year we are, 0–1. Used to leave people alone early. */
  yearProgress: number;
}

/** Long enough that it is worth a word; short enough to still be a habit. */
export const QUIET_DAYS = 21;
/** Little things change fast at these ages; three months is generous. */
export const STALE_LITTLE_THING_DAYS = 90;
/** A month is only worth mentioning once the year is well under way. */
export const EMPTY_MONTH_AFTER = 0.35;

const GENERAL: string[] = [
  "What are they saying at the moment, exactly how they say it?",
  "What is the most used thing in the house this week?",
  "What made you both laugh in the last few days?",
  "What do they ask for every single day right now?",
  "What is something they have just started doing?",
];

/**
 * Every prompt worth asking this family, best first.
 *
 * Returns a list rather than one, because the dashboard shows a few and the
 * email sends the top one — and because a caller that has already asked
 * something recently needs the next one down.
 */
export function promptsFor(state: ArchiveState): Prompt[] {
  const out: Prompt[] = [];
  const name = state.childName;

  // 1. They have gone quiet, and we know what they were last on about.
  //    The thread is quoted back verbatim; it is theirs, not ours.
  if (state.daysSinceLastMemory !== null && state.daysSinceLastMemory >= QUIET_DAYS) {
    const thread = state.recentThreads[0];
    out.push(
      thread
        ? {
            kind: "gone_quiet",
            question: `You haven't added anything since ${thread}. How's that going?`,
            // A cluster title is the family's own words, so it stays out of
            // the email even though it is what makes the question good.
            emailQuestion: `You haven't added anything for a few weeks. How's it going?`,
            because: `Nothing new for ${state.daysSinceLastMemory} days, and ${thread} was the last thing you were keeping.`,
            emailBecause: `Nothing new for ${state.daysSinceLastMemory} days.`,
            weight: 100,
          }
        : {
            kind: "gone_quiet",
            question: `It's been a few weeks. What has ${name} been up to?`,
            emailQuestion: `It's been a few weeks. What has ${name} been up to?`,
            because: `Nothing new for ${state.daysSinceLastMemory} days.`,
            emailBecause: `Nothing new for ${state.daysSinceLastMemory} days.`,
            weight: 80,
          }
    );
  }

  // 2. A little thing that has almost certainly changed. The most answerable
  //    question there is, because the parent already knows the answer.
  const stale = state.littleThings
    .filter((lt) => lt.daysOld >= STALE_LITTLE_THING_DAYS)
    .sort((a, b) => b.daysOld - a.daysOld)[0];
  if (stale) {
    out.push({
      kind: "stale_little_thing",
      question: `A while ago you wrote "${stale.value}". Is that still true?`,
      emailQuestion:
        `One of the little things you wrote down a few months ago — is it ` +
        `still true? It's in the app.`,
      because: `Recorded ${Math.round(stale.daysOld / 30)} months ago under ${stale.category.replace(/_/g, " ")}.`,
      emailBecause: `Something you recorded ${Math.round(stale.daysOld / 30)} months ago has probably changed.`,
      weight: 90,
    });
  }

  // 3. A month with nothing in it becomes a hole in the book, and this is
  //    the only warning that arrives while it can still be fixed.
  if (state.yearProgress >= EMPTY_MONTH_AFTER && state.emptyMonths.length > 0) {
    const month = state.emptyMonths[0];
    out.push({
      kind: "empty_month",
      question: `There's nothing from ${month}. Anything at all — even one photo?`,
      emailQuestion: `There's nothing from ${month}. Anything at all — even one photo?`,
      because: `${month} is empty, and an empty month leaves a gap in the book.`,
      emailBecause: `${month} is empty, and an empty month leaves a gap in the book.`,
      weight: 70,
    });
  }

  // 4. The voice is the thing people regret not having, and the one they
  //    never think of unprompted.
  if (!state.hasVoiceRecording) {
    out.push({
      kind: "no_voice_yet",
      question: `You haven't recorded ${name}'s voice yet. Thirty seconds of them talking about nothing is enough.`,
      emailQuestion: `You haven't recorded ${name}'s voice yet. Thirty seconds of them talking about nothing is enough.`,
      because: "There is no recording in the archive, and it is the thing that goes first.",
      emailBecause: "There is no recording in the archive, and it is the thing that goes first.",
      weight: 85,
    });
  }

  // 5. Photographs without words age badly — you forget what was happening.
  if (state.daysSinceLastQuote === null || state.daysSinceLastQuote > 60) {
    out.push({
      kind: "no_quotes_lately",
      question: `What is ${name} saying at the moment? Word for word, mistakes and all.`,
      emailQuestion: `What is ${name} saying at the moment? Word for word, mistakes and all.`,
      because:
        state.daysSinceLastQuote === null
          ? "Nothing they've said has been written down yet."
          : `The last thing you wrote down was ${state.daysSinceLastQuote} days ago.`,
      emailBecause:
        state.daysSinceLastQuote === null
          ? "Nothing they've said has been written down yet."
          : `The last thing you wrote down was ${state.daysSinceLastQuote} days ago.`,
      weight: 60,
    });
  }

  // 6. Nothing specific to ask. Say a general one rather than invent a
  //    detail — a wrong specific is far worse than a plain general.
  const general = pickGeneral(state);
  out.push({
    kind: "general",
    question: general,
    emailQuestion: general,
    because: "A small question, because you're up to date on everything else.",
    emailBecause: "A small question, because you're up to date on everything else.",
    weight: 10,
  });

  return out.sort((a, b) => b.weight - a.weight);
}

/** The single best question, or null when there is genuinely nothing to ask. */
export function bestPrompt(state: ArchiveState): Prompt | null {
  return promptsFor(state)[0] ?? null;
}

/**
 * Rotate the general questions deterministically off the archive's own shape,
 * so the same family is not asked the same thing every time and a re-run of
 * the same day produces the same question.
 */
function pickGeneral(state: ArchiveState): string {
  const seed =
    state.childName.length +
    state.littleThings.length * 3 +
    state.emptyMonths.length * 7 +
    Math.floor(state.yearProgress * 12);
  return GENERAL[seed % GENERAL.length];
}
