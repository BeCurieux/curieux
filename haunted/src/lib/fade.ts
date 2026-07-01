// Fading glow (CLAUDE.md §Customer surface). Client-side and deterministic — a
// pure function of (now - saved_at). Never stored; always computed. 0 = just
// saved (full glow), 1 = fully faded (~21 days).

const FADE_MS = 21 * 24 * 3600 * 1000;

export function fade(savedAt: number, now: number = Date.now()): number {
  return Math.min(1, Math.max(0, (now - savedAt) / FADE_MS));
}

export function glow(savedAt: number, now: number = Date.now()): number {
  return 1 - fade(savedAt, now);
}
