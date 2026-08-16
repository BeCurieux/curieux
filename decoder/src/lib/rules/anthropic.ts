/**
 * The Anthropic transport for rule authoring.
 *
 * One of exactly two files in `src/` permitted to import a provider SDK — the
 * other is `parse/anthropic.ts` — and `tests/stop-line.test.ts` fails if a
 * third appears. BRIEF.md §31 says never to call the model integration the
 * moat; keeping it at the edges is how that stays true in the code rather than
 * only in the pitch.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RuleAuthorTransport } from "@/lib/rules/author";

export const MODEL = "claude-opus-5";

export class AnthropicRuleAuthor implements RuleAuthorTransport {
  private readonly client: Anthropic;

  constructor(options: { apiKey?: string; client?: Anthropic } = {}) {
    this.client =
      options.client ?? new Anthropic({ apiKey: options.apiKey ?? process.env["ANTHROPIC_API_KEY"] ?? "" });
  }

  async draft(request: { system: string; user: string }): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }
}
