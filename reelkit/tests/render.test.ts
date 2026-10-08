import { describe, expect, it } from "vitest";
import { drawFrame, type Ctx, type Picture } from "../src/render/draw.js";
import { FORMATS } from "../src/render/formats.js";
import { cover, fit, wrap, type Measure } from "../src/render/layout.js";
import { buildTimeline, CROSSFADE, frameAt } from "../src/render/timeline.js";
import type { AdScript } from "../src/script/types.js";

const script: AdScript = {
  angle: "showcase",
  hook: "Meet the bud vase",
  hookImage: 0,
  scenes: [
    { caption: "Wheel-thrown stoneware", image: 1 },
    { caption: "Speckled oatmeal glaze in a soft, warm cream that suits any shelf", image: 2 },
  ],
  cta: "Shop now",
};

/** Every character is 0.6em wide — close enough to a bold sans to test with. */
const measure: Measure = (t, size) => t.length * size * 0.6;

describe("timeline", () => {
  const tl = buildTimeline(script);

  it("runs hook, scenes, end card back to back, in a feed-friendly length", () => {
    expect(tl.segments.map((s) => s.kind)).toEqual(["hook", "scene", "scene", "cta"]);
    for (let i = 1; i < tl.segments.length; i++) expect(tl.segments[i]!.start).toBe(tl.segments[i - 1]!.end);
    expect(tl.duration).toBeGreaterThan(8);
    expect(tl.duration).toBeLessThan(16);
  });

  it("gives a longer caption longer on screen", () => {
    const [, short, long] = tl.segments;
    expect(long!.end - long!.start).toBeGreaterThan(short!.end - short!.start);
  });

  it("cross-fades only at the start of a segment, and clamps outside the video", () => {
    const second = tl.segments[1]!;
    expect(frameAt(tl, second.start + CROSSFADE / 2).previous?.segment.kind).toBe("hook");
    expect(frameAt(tl, second.start + CROSSFADE * 2).previous).toBeUndefined();
    expect(frameAt(tl, -5).segment.kind).toBe("hook");
    expect(frameAt(tl, 999).segment.kind).toBe("cta");
  });
});

describe("layout", () => {
  it("wraps on words and never splits one", () => {
    expect(wrap("one two three four", 200, 50, measure)).toEqual(["one", "two", "three", "four"]);
    expect(wrap("supercalifragilistic", 10, 50, measure)).toEqual(["supercalifragilistic"]);
  });

  it("shrinks text until it fits the line budget", () => {
    const big = fit("Speckled oatmeal glaze in a soft warm cream", { width: 860, maxLines: 2, max: 104, min: 36 }, measure);
    expect(big.lines.length).toBeLessThanOrEqual(2);
    expect(big.size).toBeLessThan(104);
    for (const l of big.lines) expect(measure(l, big.size)).toBeLessThanOrEqual(860);
  });

  it("always covers the frame, at any zoom and pan", () => {
    const frame = { w: 1080, h: 1920 };
    for (const img of [{ w: 4000, h: 3000 }, { w: 800, h: 2400 }, { w: 1000, h: 1000 }]) {
      for (const [scale, px, py] of [[1, 0, 0], [1.14, 1, -1], [1.06, -5, 5]] as const) {
        const r = cover(img, frame, scale, px, py);
        expect(r.x).toBeLessThanOrEqual(0.001);
        expect(r.y).toBeLessThanOrEqual(0.001);
        expect(r.x + r.w).toBeGreaterThanOrEqual(frame.w - 0.001);
        expect(r.y + r.h).toBeGreaterThanOrEqual(frame.h - 0.001);
      }
    }
  });
});

/** A canvas that records what was drawn, with the alpha it was drawn at. */
function recorder() {
  const drawn: { op: string; text?: string; alpha: number }[] = [];
  const stack: number[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: "#000",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
    save() { stack.push(this.globalAlpha); },
    restore() { this.globalAlpha = stack.pop() ?? 1; },
    fillRect() { drawn.push({ op: "rect", alpha: this.globalAlpha }); },
    drawImage() { drawn.push({ op: "image", alpha: this.globalAlpha }); },
    fillText(text: string) { drawn.push({ op: "text", text, alpha: this.globalAlpha }); },
    measureText(t: string) { const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10); return { width: measure(t, size) }; },
    beginPath() {},
    roundRect() {},
    fill() {},
    translate() {},
    scale() {},
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return { ctx: ctx as unknown as Ctx, drawn };
}

describe("drawFrame", () => {
  const tl = buildTimeline(script);
  const pics: Picture[] = [0, 1, 2].map(() => ({ source: {} as CanvasImageSource, w: 1200, h: 1600 }));
  const card = { name: "Ceramic Bud Vase", price: "£32", shop: "Fern & Kiln" };

  it("draws every segment's words in every format", () => {
    for (const f of Object.values(FORMATS)) {
      for (const seg of tl.segments) {
        const { ctx, drawn } = recorder();
        drawFrame(ctx, frameAt(tl, seg.start + 0.9), pics, f, card);
        const text = drawn.filter((d) => d.op === "text").map((d) => d.text).join(" ");
        if (seg.kind === "cta") {
          expect(text).toContain("£32");
          expect(text).toContain("Fern & Kiln");
          expect(text).toContain("Shop now");
        } else {
          expect(text.replace(/\s+/g, " ")).toContain(seg.text.split(" ")[0]);
        }
      }
    }
  });

  it("fades the outgoing segment rather than redrawing it at full strength", () => {
    const second = tl.segments[1]!;
    const { ctx, drawn } = recorder();
    drawFrame(ctx, frameAt(tl, second.start + CROSSFADE * 0.75), pics, FORMATS["9x16"], card);
    const hookWords = drawn.filter((d) => d.op === "text" && script.hook.includes(d.text ?? "~"));
    expect(hookWords.length).toBeGreaterThan(0);
    for (const w of hookWords) expect(w.alpha).toBeLessThan(0.5);
  });

  it("survives a missing photo", () => {
    const { ctx } = recorder();
    expect(() => drawFrame(ctx, frameAt(tl, 3), [], FORMATS["1x1"], card)).not.toThrow();
  });
});
