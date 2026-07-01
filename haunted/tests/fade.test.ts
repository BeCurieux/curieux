import { describe, it, expect } from 'vitest';
import { fade, glow } from '@/lib/fade';

const DAY = 24 * 3600 * 1000;

describe('fading glow', () => {
  it('is full glow at save time', () => {
    const now = 1_700_000_000_000;
    expect(glow(now, now)).toBe(1);
    expect(fade(now, now)).toBe(0);
  });

  it('is fully faded at ~21 days', () => {
    const saved = 1_700_000_000_000;
    expect(fade(saved, saved + 21 * DAY)).toBe(1);
    expect(glow(saved, saved + 21 * DAY)).toBe(0);
  });

  it('clamps past 21 days', () => {
    const saved = 1_700_000_000_000;
    expect(fade(saved, saved + 40 * DAY)).toBe(1);
  });

  it('is monotonic and mid-range at ~10.5 days', () => {
    const saved = 1_700_000_000_000;
    expect(fade(saved, saved + 10.5 * DAY)).toBeCloseTo(0.5, 5);
  });
});
