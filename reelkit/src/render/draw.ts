/**
 * Drawing one frame. Runs in the browser against a real canvas for both the
 * live preview and the encoder; in tests against a stub that records calls.
 *
 * Layout respects the platforms' own furniture: TikTok and Reels put the
 * caption, buttons and progress bar over the bottom fifth and the right edge
 * of a vertical video, so nothing we draw lives there.
 */

import { cover, fit, type Measure } from "./layout.js";
import type { Format } from "./formats.js";
import { ease, lerp, type FrameState, type Segment } from "./timeline.js";

export type Ctx = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "fillRect"
  | "drawImage"
  | "fillText"
  | "measureText"
  | "beginPath"
  | "roundRect"
  | "fill"
  | "createLinearGradient"
  | "translate"
  | "scale"
> & {
  globalAlpha: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
};

export type Picture = { source: CanvasImageSource; w: number; h: number };

export type EndCard = { name: string; price?: string; shop?: string };

export type Theme = { accent: string; accentInk: string; font: string };

export const DEFAULT_THEME: Theme = {
  accent: "#FFD84D",
  accentInk: "#141414",
  font: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};

const fontAt = (theme: Theme, weight: number, size: number) => `${weight} ${size}px ${theme.font}`;

function measurer(ctx: Ctx, theme: Theme, weight: number): Measure {
  return (text, size) => {
    ctx.font = fontAt(theme, weight, size);
    return ctx.measureText(text).width;
  };
}

function photo(ctx: Ctx, pic: Picture | undefined, seg: Segment, progress: number, f: Format) {
  if (!pic) {
    ctx.fillStyle = "#1d1d1f";
    ctx.fillRect(0, 0, f.w, f.h);
    return;
  }
  const m = seg.motion;
  const r = cover(
    pic,
    f,
    lerp(m.fromScale, m.toScale, progress),
    lerp(m.fromX, m.toX, progress),
    lerp(m.fromY, m.toY, progress),
  );
  ctx.drawImage(pic.source, r.x, r.y, r.w, r.h);
}

function scrim(ctx: Ctx, f: Format, from: number, to: number, alpha: number) {
  const g = ctx.createLinearGradient(0, from * f.h, 0, to * f.h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(from, to) * f.h, f.w, Math.abs(to - from) * f.h);
}

function lines(ctx: Ctx, text: string[], x: number, y: number, size: number, lineHeight: number) {
  text.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineHeight));
}

/** Vertical layout differs by shape: a square has no room for a lower third. */
function zones(f: Format) {
  const tall = f.h / f.w > 1.5;
  return {
    margin: f.w * 0.08,
    hookY: f.h * (tall ? 0.24 : 0.2),
    captionY: f.h * (tall ? 0.66 : 0.72),
    hookMax: tall ? 104 : 92,
    captionMax: tall ? 58 : 52,
  };
}

function hook(ctx: Ctx, text: string, local: number, f: Format, theme: Theme, alpha: number) {
  const z = zones(f);
  const appear = ease(local / 0.4);
  const { size, lines: ls } = fit(text, { width: f.w - z.margin * 2, maxLines: 3, max: z.hookMax, min: 56 }, measurer(ctx, theme, 800));
  ctx.save();
  ctx.globalAlpha = alpha * appear;
  ctx.translate(f.w / 2, z.hookY);
  const s = lerp(0.9, 1, appear);
  ctx.scale(s, s);
  ctx.font = fontAt(theme, 800, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = size * 0.06;
  ctx.fillStyle = "#ffffff";
  lines(ctx, ls, 0, 0, size, 1.1);
  ctx.restore();
}

function caption(ctx: Ctx, text: string, local: number, f: Format, theme: Theme, alpha: number) {
  const z = zones(f);
  const appear = ease(local / 0.35);
  const padX = 34;
  const padY = 24;
  const { size, lines: ls } = fit(
    text,
    { width: f.w - z.margin * 2 - padX * 2, maxLines: 3, max: z.captionMax, min: 36 },
    measurer(ctx, theme, 700),
  );
  const measure = measurer(ctx, theme, 700);
  const w = Math.max(...ls.map((l) => measure(l, size))) + padX * 2;
  const lh = size * 1.22;
  const h = ls.length * lh + padY * 2 - (lh - size);
  ctx.save();
  ctx.globalAlpha = alpha * appear;
  ctx.translate(f.w / 2, z.captionY + lerp(28, 0, appear));
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, 0, w, h, 22);
  ctx.fill();
  ctx.font = fontAt(theme, 700, size);
  ctx.fillStyle = "#121212";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines(ctx, ls, 0, padY, size, 1.22);
  ctx.restore();
}

function endCard(ctx: Ctx, cta: string, card: EndCard, local: number, f: Format, theme: Theme, alpha: number) {
  const z = zones(f);
  const appear = ease(local / 0.45);
  ctx.save();
  ctx.globalAlpha = alpha * 0.62 * appear;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();

  const centre = f.h * (f.h / f.w > 1.5 ? 0.42 : 0.4);
  const width = f.w - z.margin * 2;
  ctx.save();
  ctx.globalAlpha = alpha * appear;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const name = fit(card.name, { width, maxLines: 2, max: 76, min: 44 }, measurer(ctx, theme, 800));
  const nameH = name.lines.length * name.size * 1.1;
  let y = centre - nameH;
  ctx.font = fontAt(theme, 800, name.size);
  ctx.fillStyle = "#ffffff";
  lines(ctx, name.lines, f.w / 2, y, name.size, 1.1);
  y += nameH + 24;

  if (card.price) {
    ctx.font = fontAt(theme, 700, 60);
    ctx.fillStyle = theme.accent;
    ctx.fillText(card.price, f.w / 2, y);
    y += 60 + 28;
  }

  const pill = fit(cta, { width: width - 120, maxLines: 1, max: 54, min: 34 }, measurer(ctx, theme, 800));
  const pw = measurer(ctx, theme, 800)(pill.lines[0] ?? cta, pill.size) + 110;
  const ph = pill.size + 56;
  const py = y + lerp(20, 0, appear);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.roundRect(f.w / 2 - pw / 2, py, pw, ph, ph / 2);
  ctx.fill();
  ctx.font = fontAt(theme, 800, pill.size);
  ctx.fillStyle = theme.accentInk;
  ctx.fillText(pill.lines[0] ?? cta, f.w / 2, py + 28);
  y = py + ph + 30;

  if (card.shop) {
    ctx.font = fontAt(theme, 600, 38);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(card.shop, f.w / 2, y);
  }
  ctx.restore();
}

/** Draws a whole segment at `alpha`. Every helper multiplies its own fades
 *  by it rather than setting opacity outright, or a fading-out layer would
 *  snap back to full strength the moment a caption drew. */
function layer(
  ctx: Ctx,
  seg: Segment,
  progress: number,
  local: number,
  pics: Picture[],
  f: Format,
  theme: Theme,
  card: EndCard,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  photo(ctx, pics[seg.image], seg, progress, f);
  if (seg.kind === "hook") scrim(ctx, f, 0.55, 0.0, 0.45);
  else if (seg.kind === "scene") scrim(ctx, f, 0.45, 1.0, 0.4);
  ctx.restore();

  if (seg.kind === "hook") hook(ctx, seg.text, local, f, theme, alpha);
  else if (seg.kind === "scene") caption(ctx, seg.text, local, f, theme, alpha);
  else endCard(ctx, seg.text, card, local, f, theme, alpha);
}

export function drawFrame(
  ctx: Ctx,
  state: FrameState,
  pics: Picture[],
  f: Format,
  card: EndCard,
  theme: Theme = DEFAULT_THEME,
) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
  layer(ctx, state.segment, state.progress, state.local, pics, f, theme, card, 1);
  if (state.previous) {
    // The outgoing segment, frozen at its last frame, fading away on top.
    const prev = state.previous.segment;
    layer(ctx, prev, 1, prev.end - prev.start, pics, f, theme, card, 1 - ease(state.previous.fade));
  }
}
