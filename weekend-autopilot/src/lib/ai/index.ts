/**
 * AI provider selection (§12). AI_PROVIDER is environment-configured, and
 * nothing outside this file knows which implementation is in play.
 */

import { serverEnv } from "@/config/env";
import type { AIProvider, AIProviderOptions } from "./provider";
import { AnthropicAIProvider } from "./anthropic";
import { MockAIProvider } from "./mock";

export function buildAIProvider(options: AIProviderOptions = {}): AIProvider {
  const env = serverEnv();
  if (env.AI_PROVIDER === "anthropic" && env.AI_API_KEY) {
    return new AnthropicAIProvider(env.AI_API_KEY, env.AI_MODEL, options);
  }
  return new MockAIProvider();
}

export type { AIProvider, AIProviderOptions } from "./provider";
