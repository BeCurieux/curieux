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

import { readFileSync } from "node:fs";

/**
 * Source with its comments removed, for assertions about what code does or
 * what a page claims.
 *
 * Only whole-line `//` comments are stripped, never mid-line: a regex that
 * eats from the first `//` onwards also eats every `https://` URL, which
 * silently removes half the line it was meant to leave alone.
 */
export function codeOnly(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")   // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, "")       // block comments, incl. JSDoc
    .replace(/^\s*\/\/.*$/gm, "");          // whole-line // comments
}

export const readCode = (path: string): string => codeOnly(readFileSync(path, "utf8"));
