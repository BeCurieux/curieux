// The journal, and the rules that stop it becoming a content mill.
//
// Every product like this eventually grows a blog, and the blog is almost
// always the part where the care runs out: forty posts targeting keywords,
// written to a brief, published on a schedule, each one slightly false. This
// product cannot afford that. It is asking families to believe some unusual
// claims about privacy and about not inventing things, and a page of thin
// SEO copy under the same wordmark undoes more trust than the traffic is
// worth.
//
// So the infrastructure has opinions.
//
//   **Every entry answers a question somebody actually asked.** `question`
//   is required and is not a subtitle — it is the sentence a parent typed
//   into a search box or put in an email. An entry that cannot name one is
//   an entry written for a keyword, and there is nowhere to put a keyword.
//
//   **Nothing is generated.** Entries are components in this repository,
//   written by a person, reviewed in a diff. There is no path from a model
//   to this page and tests/journal.test.ts checks there is not — the same
//   discipline the rest of the product applies to a family's memories,
//   applied to our own words for the same reason.
//
//   **Dates are true.** `published` is when it went out and `updated` is set
//   by hand when something is actually rewritten. The alternative — a date
//   that moves whenever the file is touched — is the oldest lie in
//   search-engine optimisation, and a product with an append-only promise
//   page has no business telling it.
//
//   **Drafts are not published.** Both here and in the sitemap and the feed,
//   from the same list, so a piece cannot be live in one and absent from
//   another.
//
// TSX rather than markdown, because this codebase has no markdown anywhere
// and adding a parser to render our own prose would be a dependency and a
// class of bug for no benefit. An entry is a component; it typechecks, it
// uses the same typography as everything else, and there is no parser to
// point at user content by accident later.

import type { ComponentType } from "react";
import { WordsGoFirst } from "@/app/journal/entries/the-words-go-first";

export interface Entry {
  /** URL, and it never changes once published. */
  slug: string;
  title: string;
  /**
   * The question a person actually asked, in their words.
   *
   * Required, and the point of the whole file. Something written to answer
   * a real question has a shape; something written for a search term does
   * not, and a reader can tell within a sentence.
   */
  question: string;
  /** One sentence, for search results and the index. */
  description: string;
  /** ISO date it went out. */
  published: string;
  /** ISO date it was genuinely rewritten. Never touched by a deploy. */
  updated?: string;
  /** Not shown anywhere until this is removed. */
  draft?: boolean;
  body: ComponentType;
}

export const ENTRIES: Entry[] = [
  {
    slug: "the-words-go-first",
    title: "The words go first",
    question: "How do I remember what my kids actually said?",
    description:
      "You will keep the photographs without trying. The mispronunciations, the names for things, the reason they would only sleep with the light on — those go, and quickly. What to write down, and how little is enough.",
    published: "2026-08-10",
    body: WordsGoFirst,
  },
];

/** What the world may see. One list, so nothing is live in two places and absent from a third. */
export const published = (): Entry[] =>
  ENTRIES.filter((e) => !e.draft).sort((a, b) => b.published.localeCompare(a.published));

export const entryBySlug = (slug: string): Entry | null =>
  published().find((e) => e.slug === slug) ?? null;

/** When the feed last changed. */
export const lastPublished = (): string =>
  published().reduce((latest, e) => {
    const at = e.updated ?? e.published;
    return at > latest ? at : latest;
  }, "1970-01-01");

/**
 * What a journal entry is not allowed to be about.
 *
 * A memory archive sits next to two kinds of writing it must never produce.
 * The first is developmental or medical advice — we are not qualified, and a
 * parent taking milestone guidance from a stationery company is a bad outcome
 * we would have caused. The second is anything about a real family: our own
 * customers are not case studies, and an illustrative family invented for a
 * blog post is the exact thing the product refuses to do inside the archive.
 */
export const NOT_ABOUT = [
  "developmental milestones, or when a child should be doing anything",
  "medical, dietary or sleep advice",
  "a real family, named or otherwise identifiable",
  "an invented family presented as a real one",
] as const;
