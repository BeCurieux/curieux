/**
 * The Anthropic vision transport.
 *
 * The only file in `src/` that imports a provider SDK, and it stays that way:
 * `tests/stop-line.test.ts` fails if any other file does. Everything upstream
 * talks to `VisionTransport`, so swapping providers — or measuring two against
 * each other, which is what §13's evaluation dataset is for — is a new file
 * next to this one rather than a change to the engine.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { VisionRequest, VisionTransport } from "@/lib/parse";

/** Recorded on every parse, alongside the prompt version. */
export const MODEL = "claude-opus-5";

export class AnthropicVision implements VisionTransport {
  private readonly client: Anthropic;

  constructor(options: { apiKey?: string; client?: Anthropic } = {}) {
    this.client =
      options.client ??
      new Anthropic({ apiKey: options.apiKey ?? process.env["ANTHROPIC_API_KEY"] ?? "" });
  }

  async read(request: VisionRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: request.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: request.mediaType, data: request.imageBase64 },
            },
            { type: "text", text: request.user },
          ],
        },
      ],
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }
}
