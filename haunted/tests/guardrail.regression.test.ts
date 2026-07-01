// Guardrail regression — a build-breaker (CLAUDE.md §Testing). Asserts the
// cozy/creepy boundary holds and that every shipped safe-bank line is itself
// vetted. Runs offline: the deterministic layer does the real work, and a stub
// classifier stands in for Layer 2b so the full validateLine path is exercised
// without the network.

import { describe, it, expect } from 'vitest';
import { passesDeterministic, validateLine, BANNED, type SafetyClassifier } from '@/lib/guardrails';
import { PERSONAS } from '@/config/personas';
import { ALL_TRIGGERS } from '@/lib/types';
import { CREEPY, COZY } from './corpus';

// A stub of the Haiku classifier. It agrees with the deterministic layer (so it
// never over-blocks cozy phrasing) and adds a few surveillance phrasings the
// regexes don't catch verbatim — the role the real LLM classifier plays. This
// stand-in only exists so the full two-layer flow is exercised offline.
const EXTRA_CREEPY = /\b(stalk|lurk|surveill|reflection|footsteps|memorized)\b/i;
const stubClassifier: SafetyClassifier = {
  async classify(line: string) {
    if (BANNED.some((rx) => rx.test(line))) return 'CREEPY';
    if (EXTRA_CREEPY.test(line)) return 'CREEPY';
    return 'COZY';
  },
};

describe('deterministic layer', () => {
  it('rejects every known-creepy line', () => {
    const survivors = CREEPY.filter((l) => passesDeterministic(l));
    expect(survivors, `these creepy lines slipped through: ${survivors.join(' | ')}`).toEqual([]);
  });

  it('passes every known-cozy line', () => {
    const blocked = COZY.filter((l) => !passesDeterministic(l));
    expect(blocked, `these cozy lines were wrongly blocked: ${blocked.join(' | ')}`).toEqual([]);
  });

  it('has a corpus of at least 50 cozy and 50 creepy lines', () => {
    expect(COZY.length).toBeGreaterThanOrEqual(50);
    expect(CREEPY.length).toBeGreaterThanOrEqual(50);
  });
});

describe('full Layer-2 validateLine', () => {
  it('rejects all creepy lines', async () => {
    for (const line of CREEPY) {
      const r = await validateLine(line, stubClassifier);
      expect(r.ok, `should reject: ${line}`).toBe(false);
    }
  });

  it('accepts all cozy lines', async () => {
    for (const line of COZY) {
      const r = await validateLine(line, stubClassifier);
      expect(r.ok, `should accept: ${line}`).toBe(true);
    }
  });
});

describe('safe banks are pre-vetted', () => {
  it('every persona ships a line for every trigger', () => {
    for (const persona of Object.values(PERSONAS)) {
      for (const trigger of ALL_TRIGGERS) {
        const bank = persona.safeBank[trigger];
        expect(bank && bank.length > 0, `${persona.key}/${trigger} bank is empty`).toBe(true);
      }
    }
  });

  it('every safe-bank line passes the full guardrail', async () => {
    for (const persona of Object.values(PERSONAS)) {
      for (const trigger of ALL_TRIGGERS) {
        for (const line of persona.safeBank[trigger]!) {
          expect(passesDeterministic(line), `deterministic fail: ${persona.key} "${line}"`).toBe(true);
          const r = await validateLine(line, stubClassifier);
          expect(r.ok, `classifier fail: ${persona.key} "${line}"`).toBe(true);
        }
      }
    }
  });
});
