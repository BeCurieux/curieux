// The voice engine's generate → validate → fallback flow (CLAUDE.md §Guardrail 2).
import { describe, it, expect } from 'vitest';
import { composeLine } from '@/lib/voice';
import type { LineGenerator } from '@/lib/anthropic';
import type { SafetyClassifier } from '@/lib/guardrails';
import { PERSONAS } from '@/config/personas';

const cozy: SafetyClassifier = { async classify() { return 'COZY'; } };
const creepy: SafetyClassifier = { async classify() { return 'CREEPY'; } };

function scripted(lines: string[]): LineGenerator {
  let i = 0;
  return { async generate() { return lines[Math.min(i++, lines.length - 1)]!; } };
}

const base = {
  persona: 'poet' as const,
  trigger: 'been_a_while' as const,
  triggerContext: 'saved 20 days ago',
  itemTitle: 'The Jacket',
  seed: 'item_1',
};

describe('composeLine', () => {
  it('uses the first generation when it validates', async () => {
    const r = await composeLine(base, scripted(['A soft quiet hello.']), cozy);
    expect(r).toMatchObject({ source: 'generated', line: 'A soft quiet hello.', rejected: 0 });
  });

  it('regenerates once when the first fails deterministic', async () => {
    // First line trips a banned pattern; second is clean.
    const r = await composeLine(base, scripted(['I am watching you.', 'Still folded, still fond.']), cozy);
    expect(r.source).toBe('regenerated');
    expect(r.line).toBe('Still folded, still fond.');
    expect(r.rejected).toBe(1);
  });

  it('falls back to the safe bank when both generations are creepy', async () => {
    const r = await composeLine(base, scripted(['fine one', 'another fine one']), creepy);
    expect(r.source).toBe('safe_bank');
    expect(r.fallbackReason).toBe('rejected');
    expect(PERSONAS.poet.safeBank.been_a_while).toContain(r.line);
    expect(r.rejected).toBe(2);
  });

  it('falls back on outage (generator throws) and marks it an error, not a rejection', async () => {
    const boom: LineGenerator = { async generate() { throw new Error('rate limit'); } };
    const r = await composeLine(base, boom, cozy);
    expect(r.source).toBe('safe_bank');
    expect(r.fallbackReason).toBe('error');
    expect(PERSONAS.poet.safeBank.been_a_while).toContain(r.line);
  });

  it('safe-bank pick is deterministic for a given seed', async () => {
    const a = await composeLine(base, scripted(['x']), creepy);
    const b = await composeLine(base, scripted(['y']), creepy);
    expect(a.line).toBe(b.line);
  });
});
