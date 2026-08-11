/**
 * The request shape and the three ways a response can arrive without a plan
 * in it. Nothing here touches the network — the SDK client is faked, because
 * what matters is that the request carries the schema and that a refusal, a
 * truncation and a non-JSON body each fail with a message that says which.
 */

import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicProvider } from "@/lib/merchandise/anthropic";
import { MerchandiseError } from "@/lib/merchandise/errors";
import { MERCHANDISING_PLAN_SCHEMA } from "@/lib/merchandise/plan-schema";
import { buildPlan } from "@/lib/merchandise/mock";
import { makeIngest } from "./helpers/ingest";

const ingest = makeIngest();
const PROMPT = "A clean bio shop";
const plan = buildPlan(ingest, PROMPT);

function fakeClient(response: Record<string, unknown>) {
  const create = vi.fn(async (_body: Record<string, any>) => ({
    stop_reason: "end_turn",
    model: "claude-opus-5",
    usage: { input_tokens: 4200, output_tokens: 610 },
    content: [],
    ...response,
  }));
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

const textResponse = (text: string) => ({ content: [{ type: "text", text }] });

function request(corrections: { attempted: unknown; errors: string[] }[] = []) {
  return { ingest, prompt: PROMPT, system: "SYSTEM", brief: "BRIEF", corrections };
}

describe("the request", () => {
  it("carries the plan schema, the effort and the model", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(plan)));
    const provider = createAnthropicProvider({ client, model: "claude-opus-5", effort: "high" });

    const result = await provider.generate(request());

    const body = create.mock.calls[0]![0];
    expect(body.model).toBe("claude-opus-5");
    expect(body.output_config.format).toEqual({ type: "json_schema", schema: MERCHANDISING_PLAN_SCHEMA });
    expect(body.output_config.effort).toBe("high");
    expect(result.plan).toEqual(plan);
    expect(result.usage).toEqual({ inputTokens: 4200, outputTokens: 610 });
  });

  it("caches the system prompt and the brief, which retries re-read", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(plan)));
    await createAnthropicProvider({ client }).generate(request());

    const body = create.mock.calls[0]![0];
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(body.messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("opts into the server-side fallback rather than surfacing a false refusal", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(plan)));
    await createAnthropicProvider({ client }).generate(request());

    const body = create.mock.calls[0]![0];
    expect(body.fallbacks).toBe("default");
    expect(body.betas).toContain("server-side-fallback-2026-07-01");
  });

  it("replays the rejected plan next to its errors", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(plan)));
    await createAnthropicProvider({ client }).generate(
      request([{ attempted: { blocks: [] }, errors: ['handle "nope" is not in the catalogue'] }]),
    );

    const body = create.mock.calls[0]![0];
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1].role).toBe("assistant");
    expect(body.messages[1].content[0].text).toBe(JSON.stringify({ blocks: [] }));
    expect(body.messages[2].content[0].text).toContain('handle "nope" is not in the catalogue');
  });
});

describe("responses with no plan in them", () => {
  it("names a refusal as a refusal", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
      content: [],
    });
    const error = await createAnthropicProvider({ client }).generate(request()).catch((e: unknown) => e);
    expect((error as MerchandiseError).code).toBe("refused");
  });

  it("names a truncation as a truncation rather than bad JSON", async () => {
    // The content on a truncated response is a half-written object; parsing it
    // would report a syntax error instead of "the plan ran out of room".
    const { client } = fakeClient({ stop_reason: "max_tokens", ...textResponse('{"blocks":[{"id":"he') });
    const error = await createAnthropicProvider({ client }).generate(request()).catch((e: unknown) => e);
    expect((error as MerchandiseError).code).toBe("truncated");
    expect((error as MerchandiseError).message).toContain("ceiling");
  });

  it("reports a body that is not JSON", async () => {
    const { client } = fakeClient(textResponse("Here is your shop!"));
    const error = await createAnthropicProvider({ client }).generate(request()).catch((e: unknown) => e);
    expect((error as MerchandiseError).code).toBe("unparseable");
  });
});

describe("construction", () => {
  it("refuses to build without a key, and says what to run instead", () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => createAnthropicProvider()).toThrow(/AI_PROVIDER=mock/);
    } finally {
      if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
    }
  });

  it("defaults to Opus, because merchandising is the product", () => {
    const { client } = fakeClient(textResponse(JSON.stringify(plan)));
    expect(createAnthropicProvider({ client }).name).toBe("anthropic:claude-opus-5");
  });
});
