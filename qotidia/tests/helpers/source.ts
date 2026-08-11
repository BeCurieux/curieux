// Reading source in tests without reading its comments.
//
// Three separate tests in this suite have now failed on a comment that
// described the very thing the test was written to catch — a page that
// "must not say no subscription" tripping on a comment explaining that it
// used to, a cancellation branch that "must not touch storage" tripping on a
// comment promising it doesn't, and a tagline check tripping on the note
// recording what the old tagline was.
//
// A test that reads comments is testing the documentation. That is not
// nothing, but it is not what any of these meant, and the failure mode is
// worse than useless: it goes red for a change that was correct, and the
// obvious fix is to delete the explanatory comment.
//
// ## The bug this file had for a long time
//
// The block-comment rule used to be:
//
//     .replace(/\/\*[\s\S]*?\*\//g, "")
//
// `accept="image/*"` contains `/*`. In any file with a file picker in it,
// that started a comment inside a string literal and deleted everything up to
// the next `*/` — which in a TSX file is the end of the next JSX comment,
// often hundreds of lines away. Roughly a third of one component was being
// silently discarded before assertions ran against it.
//
// That is the dangerous direction for this class of bug. A guard that fails
// wrongly is noticed within a minute; a guard that *passes* wrongly is
// indistinguishable from one that works, and several of the guards in this
// suite are load-bearing claims about privacy. It was found by an assertion
// that expected to *see* something and saw nothing, which is the only reason
// it was found at all.
//
// The fix is to strip a block comment only where its opener begins a line,
// which is where every real comment in this codebase starts. A `/*` in the
// middle of a line is a string or a regex, and leaving it alone costs
// nothing.

import { readFileSync } from "node:fs";

/**
 * Source with its comments removed, for assertions about what code does or
 * what a page claims.
 *
 * Only whole-line comments are stripped, never mid-line: a regex that eats
 * from the first `//` onwards also eats every `https://` URL, and one that
 * eats from any `/*` onwards eats `accept="image/​*"` and much of what
 * follows it.
 */
export function codeOnly(source: string): string {
  return source
    // JSX and block comments, but only where the opener starts a line.
    .replace(/^[ \t]*\{\/\*[\s\S]*?\*\/\}[ \t]*$/gm, "")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    // Whole-line // and -- comments, and the continuation lines of a JSDoc
    // block, which begin with an asterisk.
    .replace(/^[ \t]*(\/\/|--|\*).*$/gm, "");
}

export const readCode = (path: string): string => codeOnly(readFileSync(path, "utf8"));
