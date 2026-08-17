/**
 * Which variable the API key arrives in.
 *
 * `ANTHROPIC_API_KEY` is the obvious name and stays the first-class one: it is
 * what the SDK documents, what every other project uses, and what a developer
 * will set on a laptop without being told.
 *
 * It is also a name somebody else already owns. Inside a coding agent — Claude
 * Code, and anything else that talks to the same API on its own behalf — that
 * variable is the *agent's* credential, so the environment either strips a
 * user-supplied value or would be hijacked by one. Setting it there looks like
 * it worked and silently does nothing: `AI_PROVIDER=anthropic` arrives, the key
 * does not, and generation fails with "the key is not set" while the dashboard
 * plainly shows it is.
 *
 * So there is a second name that nothing else claims. Checked first, because a
 * developer who has gone to the trouble of setting the specific one means it;
 * `ANTHROPIC_API_KEY` remains the fallback and remains what `.env.example`
 * suggests, since on a laptop it is the right answer.
 *
 * This is not a workaround for a bug. Two processes in one environment both
 * needing an Anthropic credential is the normal case now, and a project that
 * only reads the shared name cannot be run from inside one.
 */

export const KEY_VARS = ["POPUUP_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"] as const;

export interface KeyEnv {
  POPUUP_ANTHROPIC_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
}

/**
 * The key, from whichever variable carries it.
 *
 * Blank is treated as absent. A variable set to "" in a dashboard is how this
 * silently picks the wrong branch: it is present, and it means nothing.
 */
export function anthropicApiKey(env: KeyEnv = process.env as KeyEnv): string | undefined {
  for (const name of KEY_VARS) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** True when either name carries something. */
export function hasAnthropicKey(env: KeyEnv = process.env as KeyEnv): boolean {
  return anthropicApiKey(env) !== undefined;
}

/**
 * What to say when it is missing.
 *
 * Names both variables, because the reader is in one of two situations and the
 * message cannot tell which: at a terminal, where the first name is noise, or
 * inside an agent, where it is the entire answer and the obvious name will
 * never work no matter how many times they set it.
 */
export const MISSING_KEY = [
  "No Anthropic API key found.",
  `Set ${KEY_VARS[1]} — or, if you are running inside a coding agent that uses that name for itself, ${KEY_VARS[0]}.`,
  "Or run with AI_PROVIDER=mock for the deterministic providers.",
].join(" ");
