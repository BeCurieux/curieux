// The voice engine flow (CLAUDE.md §Guardrail 2): generate → validate → fall
// back. An unvalidated line is NEVER sent, and a haunt is NEVER skipped for lack
// of a line — the persona safe bank guarantees a vetted line every time.
//
//   1. Generate → validate. Pass → use it.
//   2. Fail → regenerate once → validate.
//   3. Fail again → pull from the persona's safe bank (hand-written, pre-vetted).
//
// The result records which path produced the line so the sender can log the
// precise story (generated / regenerated / safe-bank fallback) to haunt_events.

import { getPersona } from '@/config/personas';
import { safeBankLine } from '@/config/personas';
import type { PersonaKey, Trigger } from '@/lib/types';
import { validateLine, type SafetyClassifier } from '@/lib/guardrails';
import type { LineGenerator } from '@/lib/anthropic';

export type VoiceSource = 'generated' | 'regenerated' | 'safe_bank';

export interface VoiceResult {
  line: string;
  source: VoiceSource;
  // How many generated candidates were rejected before we landed the line.
  rejected: number;
  // Why we fell back to the safe bank (only set when source === 'safe_bank'):
  //   'rejected' — generations were unsafe (log a suppressed_safety audit row)
  //   'error'    — generation/classifier was down (an outage, not a safety event)
  fallbackReason?: 'rejected' | 'error';
}

export interface VoiceInput {
  persona: PersonaKey;
  trigger: Trigger;
  triggerContext: string;
  itemTitle: string;
  // Stable seed (e.g. item id) so a safe-bank fallback is deterministic.
  seed?: string;
}

export async function composeLine(
  input: VoiceInput,
  generator: LineGenerator,
  classifier: SafetyClassifier,
): Promise<VoiceResult> {
  const persona = getPersona(input.persona);
  const genArgs = {
    persona,
    triggerContext: input.triggerContext,
    itemTitle: input.itemTitle,
  };

  // Attempt 1 — generate.
  let rejected = 0;
  let fallbackReason: 'rejected' | 'error' = 'rejected';
  try {
    const first = await generator.generate(genArgs);
    if ((await validateLine(first, classifier)).ok) {
      return { line: first, source: 'generated', rejected };
    }
    rejected++;

    // Attempt 2 — regenerate once.
    const second = await generator.generate(genArgs);
    if ((await validateLine(second, classifier)).ok) {
      return { line: second, source: 'regenerated', rejected };
    }
    rejected++;
  } catch {
    // Generation or the classifier threw (network, rate limit, bad key). We do
    // not skip the haunt — fall through to the safe bank. This is an outage, not
    // a safety rejection.
    fallbackReason = 'error';
  }

  // Fallback — a hand-written line that is pre-vetted against the same guardrail
  // (the regression suite guarantees every safe-bank line passes). No extra
  // classifier call needed.
  return {
    line: safeBankLine(input.persona, input.trigger, input.seed ?? input.itemTitle),
    source: 'safe_bank',
    rejected,
    fallbackReason,
  };
}
