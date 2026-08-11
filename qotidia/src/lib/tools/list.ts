// The free tools, and the one property that makes them worth having.
//
// A "free tool" in growth marketing is usually a form with a result behind
// it: you give it your email, it gives you a number, and the number was never
// the point. This registry exists to make that shape impossible to build here
// by accident.
//
//   **No account, and no email.** A tool that collects an address before it
//   works is an advertisement wearing a lab coat. tests/tools.test.ts refuses
//   any input that asks for one.
//
//   **Nothing leaves the device.** Every tool listed here runs entirely in
//   the browser. That is not a policy — it is checked, because it is also the
//   most persuasive thing this product can demonstrate: a page that reads a
//   camera roll and uploads nothing is an argument that no privacy copy can
//   match.
//
//   **It runs the real engine.** The point of a tool is that it does the
//   thing the product does, on the visitor's own material, honestly. A
//   simplified imitation would be both less useful and less true.
//
// Same shape as the journal registry next door, for the same reason: one
// list, so the index, the sitemap and anything else cannot disagree about
// what exists.

import type { ComponentType } from "react";
import { WhatYourPhotosKnow } from "@/app/tools/what-your-photos-know/tool";

export interface Tool {
  /** URL, and it never changes once published. */
  slug: string;
  title: string;
  /** The question a person actually has. Not a tagline. */
  question: string;
  /** One sentence, for search results and the index. */
  description: string;
  /**
   * The promise, in the visitor's terms, shown before they use it.
   *
   * Required. A tool whose data handling cannot be stated in one sentence
   * above the fold is a tool doing something it would rather not mention.
   */
  promise: string;
  published: string;
  draft?: boolean;
  tool: ComponentType;
}

export const TOOLS: Tool[] = [
  {
    slug: "what-your-photos-know",
    title: "What your photographs already know",
    question: "Can I see what my camera roll says about last year?",
    description:
      "Drop in a year of photographs and see the shape of it: the day you took the most, the weekday that keeps coming back, the month that went quiet. Nothing is uploaded — your browser does all of it.",
    promise: "No account, no email, and nothing leaves your device.",
    published: "2026-08-10",
    tool: WhatYourPhotosKnow,
  },
];

export const publishedTools = (): Tool[] =>
  TOOLS.filter((t) => !t.draft).sort((a, b) => b.published.localeCompare(a.published));

export const toolBySlug = (slug: string): Tool | null =>
  publishedTools().find((t) => t.slug === slug) ?? null;

/**
 * What a tool on this site may never do.
 *
 * The list is short because the rules are structural rather than editorial:
 * each of these is a thing the code is checked for, not a thing we intend to
 * avoid.
 */
export const NEVER = [
  "ask for an email address, or anything else, before it works",
  "upload, read or store the files you give it",
  "keep a result, or a count, or a record that you were here",
  "show you a partial answer and charge for the rest",
] as const;
