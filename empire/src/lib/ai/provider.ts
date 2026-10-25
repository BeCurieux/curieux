import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import type { ModuleKey, ModuleOutput } from "@/lib/domain/modules";

// The one seam between the studio and any model. The generation service
// (src/lib/generation/run.ts) validates and guards whatever comes back, so a
// provider is never trusted to produce well-formed or truthful output.

export interface GenerationOptions {
  /** Free accounts get one sample Sidekick prompt rather than ten. */
  sampleOnly?: boolean;
}

export interface GenerationInput<M extends ModuleKey = ModuleKey> {
  module: M;
  profile: BusinessProfile;
  /** For product modules. */
  product?: Product;
  /** Every product in the business, for marketing that mentions them. */
  products: Product[];
  options: GenerationOptions;
  signal?: AbortSignal;
}

export interface GenerationResult<M extends ModuleKey = ModuleKey> {
  /** Unvalidated: the service parses it against the module's schema. */
  output: unknown;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Kept only so the type flows; never read. */
  _module?: M;
}

export interface AIProvider {
  readonly name: "mock" | "anthropic";
  generate<M extends ModuleKey>(input: GenerationInput<M>): Promise<GenerationResult<M>>;
}

export type Typed<M extends ModuleKey> = ModuleOutput<M>;

let override: AIProvider | null = null;

/** Test seam. */
export function setAIProvider(provider: AIProvider | null): void {
  override = provider;
}

export async function getAIProvider(name: "mock" | "anthropic"): Promise<AIProvider> {
  if (override) return override;
  if (name === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider();
  }
  const { MockProvider } = await import("./mock");
  return new MockProvider();
}
