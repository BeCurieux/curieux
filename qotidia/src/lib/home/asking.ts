// The questions worth answering, in one place.
//
// There were four. A context question on one page, an identity question on
// another, the prompt engine's question in a card of its own, and the
// follow-up count in a third card — each reasonable on its own, and together
// a dashboard that asks a parent for four things before they have seen a
// photograph of their child.
//
// That is the failure mode this module exists to prevent. A product that
// notices things has to be careful that noticing does not turn into a queue,
// because a queue is homework and homework gets abandoned. Once it is
// abandoned the answers stop, and the answers are the entire compounding
// asset.
//
// ## Three rules
//
//   **Three at most, and zero is a good answer.** A home screen that always
//   has exactly three things to do is one nobody believes by the fourth
//   week. Most weeks should be empty.
//
//   **They compete on merit.** All four sources rank in one list. A question
//   about a thing that has stopped beats a routine prompt, every time,
//   because one of them has a deadline and the other does not.
//
//   **Never a chore.** Tagging, filing and reviewing are work the product
//   asks for; they are not questions and they do not belong here. They stay
//   as quiet links. The difference is whether answering it tells us
//   something only this family knows.
//
//   **One of each kind.** Two context questions in a three-item list read as
//   a form, and the two highest-ranked ones are usually the same wondering
//   about different things — which rendered, verbatim, as "Did something
//   happen, or did it just stop?" twice in a row. Variety is also better
//   ranking: the second-best question of one kind is worth less than the
//   best question of another.

import { countOf } from "@/lib/words";
import { contextQuestions, type ContextQuestion } from "@/lib/graph/context";
import { askAbout, oneToAsk, type Pair } from "@/lib/graph/identity";
import type { Entity } from "@/lib/graph/presence";

/** How many a home screen may show. */
export const MOST = 3;

export type AskKind = "context" | "identity" | "prompt" | "followup";

export interface Ask {
  id: string;
  kind: AskKind;
  /** The question, in the product's own voice. */
  question: string;
  /** Why we are asking — the arithmetic, where there is any. */
  because: string | null;
  href: string;
  weight: number;
}

/**
 * Base weights, before a source's own ranking is added.
 *
 * Context sits above identity because a fading thing is losing its answer
 * every month, while "are these two the same person" will get the same
 * answer in a year. The prompt engine ranks below both: it asks about
 * something already recorded, so nothing is lost by asking it later.
 */
const BASE: Record<AskKind, number> = {
  context: 300,
  identity: 200,
  prompt: 100,
  followup: 50,
};

export interface AskingInput {
  subjectId: string;
  entities: Entity[];
  today: string;
  settledContext: Set<string>;
  // A list rather than a Set, because that is what identity-store returns.
  // Matched here rather than changed there: the two stores landed on
  // different shapes for the same idea, and unifying them is a separate
  // change from this one.
  settledIdentity: string[];
  /** From lib/prompts/engine — already chosen, or null. */
  prompt: { question: string; because: string } | null;
  /** How many follow-up questions are waiting. */
  followUps: number;
}

export function whatToAsk(input: AskingInput): Ask[] {
  const out: Ask[] = [];

  const context = contextQuestions(input.entities, input.today, input.settledContext);
  if (context.length > 0) out.push(fromContext(context[0], input.subjectId));

  const pair = oneToAsk({ entities: input.entities, settled: input.settledIdentity });
  if (pair) out.push(fromIdentity(pair, input.subjectId));

  if (input.prompt) {
    out.push({
      id: `prompt:${input.prompt.question.slice(0, 40)}`,
      kind: "prompt",
      question: input.prompt.question,
      because: input.prompt.because,
      href: `/subjects/${input.subjectId}/upload`,
      weight: BASE.prompt,
    });
  }

  if (input.followUps > 0) {
    out.push({
      id: "followup",
      kind: "followup",
      // Spelled out, like every other count in the product. "There are 2
      // things" read as a notification badge on a page that is trying not
      // to be one.
      question:
        input.followUps === 1
          ? "There's one thing the photographs couldn't tell us."
          : `There are ${countOf(input.followUps, "thing")} the photographs couldn't tell us.`,
      because: null,
      href: `/subjects/${input.subjectId}/questions`,
      // Below its base, so a bundle of questions on another page never
      // outranks a specific one that can be answered here.
      weight: BASE.followup,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, MOST);
}

function fromContext(q: ContextQuestion, subjectId: string): Ask {
  return {
    id: `context:${q.entityId}:${q.wondering}`,
    kind: "context",
    question: q.ask,
    because: q.because,
    href: `/subjects/${subjectId}/about`,
    // The engine's own ranking rides on top, so "what happened to the thing
    // that stopped" stays ahead of "what is this tag" within the source too.
    weight: BASE.context + q.weight,
  };
}

function fromIdentity(pair: Pair, subjectId: string): Ask {
  return {
    id: `identity:${pair.a}:${pair.b}`,
    kind: "identity",
    question: askAbout(pair),
    because:
      pair.sharedMemoryIds.length > 0
        ? pair.sharedMemoryIds.length === 1
          ? "One memory has both names on it."
          : `${pair.sharedMemoryIds.length} memories have both names on them.`
        : null,
    href: `/subjects/${subjectId}/who`,
    weight: BASE.identity,
  };
}
