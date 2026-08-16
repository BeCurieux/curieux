/**
 * Photograph → `ParsedLabel`.
 *
 * Model-agnostic by construction: this file knows about a `VisionTransport`
 * and nothing else. The Anthropic implementation lives in `anthropic.ts` and is
 * the only file in `src/` allowed to import a provider SDK — which is asserted
 * by `tests/stop-line.test.ts`, because "model-agnostic" is a claim that decays
 * silently the first time somebody imports the SDK one directory over.
 */

import { ParsedLabel } from "@/lib/schema";
import { PROMPT_VERSION, SYSTEM_PROMPT, USER_PROMPT } from "@/lib/parse/prompt";

export { PROMPT_VERSION } from "@/lib/parse/prompt";

export type VisionRequest = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  system: string;
  user: string;
};

/** One method, so a fake is one line and the test suite never needs a network. */
export interface VisionTransport {
  read(request: VisionRequest): Promise<string>;
}

export class ParseError extends Error {
  constructor(
    message: string,
    readonly attempts: string[],
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Models fence JSON, preface it, or both. Pull the outermost object out rather
 * than failing on a decoration.
 */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object in the response");
  }
  return JSON.parse(body.slice(start, end + 1));
}

export type ParseResult = {
  label: ParsedLabel;
  provenance: { promptVersion: string; attempts: number };
};

/**
 * Read a label, validating the response and retrying with the error.
 *
 * The retry hands the model its own validation failure, which is the cheap
 * version of what CLAUDE.md requires: never build a verdict on unvalidated
 * output. If it still does not validate, this throws — the caller shows an
 * error, and does not show a verdict. A verdict built on a half-parsed label is
 * the failure that arrives as a screenshot.
 */
export async function parseLabel(
  input: { imageBase64: string; mediaType: VisionRequest["mediaType"] },
  transport: VisionTransport,
  options: { maxAttempts?: number } = {},
): Promise<ParseResult> {
  const maxAttempts = options.maxAttempts ?? 2;
  const raw: string[] = [];
  let user = USER_PROMPT;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const text = await transport.read({
      imageBase64: input.imageBase64,
      mediaType: input.mediaType,
      system: SYSTEM_PROMPT,
      user,
    });
    raw.push(text);

    try {
      const parsed = ParsedLabel.parse(extractJson(text));
      return { label: parsed, provenance: { promptVersion: PROMPT_VERSION, attempts: attempt } };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      user = `${USER_PROMPT}\n\nYour previous response could not be used. The error was:\n\n${reason}\n\nReturn only the JSON object, matching the shape exactly.`;
    }
  }

  throw new ParseError(`the label could not be read after ${maxAttempts} attempts`, raw);
}
