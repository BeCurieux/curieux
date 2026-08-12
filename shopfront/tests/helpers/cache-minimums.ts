/**
 * The shortest prefix each model will cache, and a way to guess whether ours
 * clears it.
 *
 * A `cache_control` breakpoint on a prefix below its model's minimum does not
 * error and does not warn. It silently does not cache: `cache_creation_input_
 * tokens` comes back 0 and every request pays full price for a prompt the code
 * plainly believes is cached. The only way to notice in production is to read
 * the usage numbers on the second call and wonder why they did not move.
 *
 * Worth writing down because **the minimums are not monotonic across
 * generations** — newer is not lower. Claude Opus 5 halved Opus 4.8's, while
 * Opus 4.6 and Haiku 4.5 are eight times higher than either. A prompt that
 * caches on the model we ship can stop caching because someone set
 * `GENOME_MODEL` to an *older* one, which is the opposite of the direction
 * anybody checks.
 *
 * Source: the Anthropic prompt-caching documentation, read 2026-08-12.
 */
export const CACHE_MINIMUM_TOKENS: Record<string, number> = {
  "claude-opus-5": 512,
  "claude-fable-5": 512,
  "claude-mythos-5": 512,
  "claude-opus-4-8": 1024,
  "claude-sonnet-5": 1024,
  "claude-sonnet-4-6": 1024,
  "claude-sonnet-4-5": 1024,
  "claude-opus-4-1": 1024,
  "claude-opus-4-0": 1024,
  "claude-sonnet-4-0": 1024,
  "claude-opus-4-7": 2048,
  "claude-haiku-3-5": 2048,
  "claude-opus-4-6": 4096,
  "claude-opus-4-5": 4096,
  "claude-haiku-4-5": 4096,
};

/**
 * Characters per token, chosen to *overstate* the token count.
 *
 * There is no tokenizer here — counting properly means `messages.count_tokens`,
 * which needs a key and a network. English prose runs about 3.5–4.2 characters
 * per token, so dividing by 3 credits the prompt with more tokens than it has.
 *
 * That direction is the safe one for the assertion below: a prompt this
 * estimate calls too short is certainly too short, so the check cannot fail on
 * a prompt that would really have cached. It can pass one that would not — the
 * gap is why the assertion demands headroom rather than a bare pass.
 */
const OPTIMISTIC_CHARS_PER_TOKEN = 3;

/** An upper bound on the tokens in a string. Never an exact count. */
export function atMostTokens(text: string): number {
  return Math.ceil(text.length / OPTIMISTIC_CHARS_PER_TOKEN);
}

/**
 * Whether a cached prefix is long enough to be worth a breakpoint on a model.
 *
 * `headroom` is a multiplier on the minimum rather than a flat margin: the
 * estimate above is coarse, and a prompt sitting a few tokens over the line
 * would be a caching bug waiting for someone to trim a sentence.
 */
export function cachesOn(text: string, model: string, headroom = 1.25): { ok: boolean; detail: string } {
  const minimum = CACHE_MINIMUM_TOKENS[model];
  if (minimum === undefined) {
    return { ok: false, detail: `no recorded cache minimum for "${model}" — add it to CACHE_MINIMUM_TOKENS` };
  }
  const tokens = atMostTokens(text);
  const needed = Math.ceil(minimum * headroom);
  return {
    ok: tokens >= needed,
    detail: `${text.length} chars ≤ ~${tokens} tokens against ${model}'s ${minimum}-token minimum (want ≥ ${needed} for headroom)`,
  };
}
