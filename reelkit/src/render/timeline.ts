/**
 * When everything happens. Pure: a script in, segments with times out, and a
 * lookup from a time to what is on screen. The preview and the encoder both
 * read from this, so what the seller watches is what they download.
 */

import type { AdScript } from "../script/types.js";

export type Motion = { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };

export type Segment = {
  kind: "hook" | "scene" | "cta";
  start: number;
  end: number;
  text: string;
  image: number;
  motion: Motion;
};

export type Timeline = { segments: Segment[]; duration: number };

/** Long enough to read: a floor, plus time per word. */
export function readTime(text: string, floor: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(floor, Math.min(4, 0.8 + words * 0.3));
}

// Slow pushes and drifts, alternating so consecutive photos never move the
// same way. Pans are fractions of the overflow a zoom creates, so a pan can
// never reveal an edge.
const MOTIONS: Motion[] = [
  { fromScale: 1.0, toScale: 1.1, fromX: 0, toX: 0, fromY: 0, toY: 0 },
  { fromScale: 1.12, toScale: 1.04, fromX: -0.6, toX: 0.6, fromY: 0, toY: 0 },
  { fromScale: 1.06, toScale: 1.14, fromX: 0.4, toX: -0.2, fromY: 0.5, toY: -0.3 },
  { fromScale: 1.14, toScale: 1.02, fromX: 0, toX: 0, fromY: -0.5, toY: 0.4 },
];

export function buildTimeline(script: AdScript): Timeline {
  const parts: { kind: Segment["kind"]; text: string; image: number; len: number }[] = [
    { kind: "hook", text: script.hook, image: script.hookImage, len: readTime(script.hook, 1.8) },
    ...script.scenes.map((s) => ({
      kind: "scene" as const,
      text: s.caption,
      image: s.image,
      len: readTime(s.caption, 2.2),
    })),
    { kind: "cta", text: script.cta, image: script.hookImage, len: 2.6 },
  ];

  let t = 0;
  const segments = parts.map(({ len, ...p }, i): Segment => {
    const seg = { ...p, start: t, end: t + len, motion: MOTIONS[i % MOTIONS.length]! };
    t += len;
    return seg;
  });
  return { segments, duration: t };
}

export type FrameState = {
  segment: Segment;
  /** 0 → 1 across the segment. */
  progress: number;
  /** Seconds since the segment began. */
  local: number;
  /** The segment before, while cross-fading out of it; and how far the fade is. */
  previous?: { segment: Segment; fade: number };
};

export const CROSSFADE = 0.35;

export function frameAt(tl: Timeline, t: number): FrameState {
  const time = Math.max(0, Math.min(t, tl.duration - 1e-6));
  let i = tl.segments.findIndex((s) => time < s.end);
  if (i < 0) i = tl.segments.length - 1;
  const segment = tl.segments[i]!;
  const local = time - segment.start;
  const progress = local / (segment.end - segment.start);
  const state: FrameState = { segment, progress, local };
  const prev = tl.segments[i - 1];
  if (prev && local < CROSSFADE) state.previous = { segment: prev, fade: local / CROSSFADE };
  return state;
}

export const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
