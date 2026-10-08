"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawFrame, type Ctx, type EndCard, type Picture } from "@/render/draw";
import { FORMATS, type FormatId } from "@/render/formats";
import { buildTimeline, frameAt } from "@/render/timeline";
import { fitImages } from "@/script/check";
import { ANGLE_LABEL, LIMITS, type Written } from "@/script/types";

/** Preview canvases draw at half resolution: identical layout, a quarter of
 *  the pixels, and smooth on a phone. */
const PREVIEW_SCALE = 0.5;

type Props = {
  ad: Written;
  pictures: Picture[];
  card: EndCard;
  slug: string;
  onChange: (ad: Written) => void;
};

export default function AdCard({ ad, pictures, card, slug, onChange }: Props) {
  const [format, setFormat] = useState<FormatId>("9x16");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0.6);

  const f = FORMATS[format];
  const script = useMemo(() => fitImages(ad, pictures.length), [ad, pictures.length]);
  const timeline = useMemo(() => buildTimeline(script), [script]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d") as unknown as (Ctx & CanvasRenderingContext2D) | null;
    if (!el || !ctx) return;
    el.width = Math.round(f.w * PREVIEW_SCALE);
    el.height = Math.round(f.h * PREVIEW_SCALE);

    const paint = () => {
      ctx.setTransform(PREVIEW_SCALE, 0, 0, PREVIEW_SCALE, 0, 0);
      drawFrame(ctx, frameAt(timeline, clock.current), pictures, f, card);
    };
    if (!playing) {
      paint();
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.current = (clock.current + (now - last) / 1000) % timeline.duration;
      last = now;
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline, pictures, f, card]);

  const edit = (patch: Partial<Written>) => onChange({ ...ad, ...patch });
  const editScene = (i: number, caption: string) =>
    edit({ scenes: ad.scenes.map((s, j) => (j === i ? { ...s, caption } : s)) });

  async function download() {
    setError(null);
    setPlaying(false);
    setProgress(0);
    try {
      const { encodeAd } = await import("@/render/encode");
      const out = await encodeAd({ script, pictures, format: f, card, onProgress: setProgress });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out.blob);
      a.download = `${slug}-${ad.angle}-${format}.${out.extension}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      if (out.extension !== "mp4") {
        setError("Your browser could only make a WebM file. For TikTok and Meta, an MP4 from Chrome, Edge or Safari is safer.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video couldn't be made.");
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <article className="ad">
      <header>
        <h3>{ANGLE_LABEL[ad.angle]}</h3>
        <span className="by" title={ad.by === "claude" ? "Drafted by AI from your listing, then checked against it" : "Written from your listing's own words"}>
          {ad.by === "claude" ? "AI draft" : "From your listing"}
        </span>
      </header>

      <div
        className="stage"
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pause preview" : "Play preview"}
        onClick={() => setPlaying((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setPlaying((p) => !p);
          }
        }}
      >
        <canvas ref={canvas} />
        <span className="play">{playing ? "Pause" : `Play · ${Math.round(timeline.duration)}s`}</span>
      </div>

      <div className="copy">
        <span className="tag">Hook</span>
        <input value={ad.hook} maxLength={LIMITS.hook} onChange={(e) => edit({ hook: e.target.value })} aria-label="Hook" />
        <span className="tag">Captions</span>
        {ad.scenes.map((s, i) => (
          <input
            key={i}
            value={s.caption}
            maxLength={LIMITS.caption}
            onChange={(e) => editScene(i, e.target.value)}
            aria-label={`Caption ${i + 1}`}
          />
        ))}
        <span className="tag">Button</span>
        <input value={ad.cta} maxLength={LIMITS.cta} onChange={(e) => edit({ cta: e.target.value })} aria-label="Call to action" />
      </div>

      <div className="download">
        <select value={format} onChange={(e) => setFormat(e.target.value as FormatId)} aria-label="Video shape" disabled={busy}>
          {(Object.keys(FORMATS) as FormatId[]).map((id) => (
            <option key={id} value={id}>
              {id.replace("x", ":")} · {FORMATS[id].label}
            </option>
          ))}
        </select>
        <button className="primary" onClick={download} disabled={busy}>
          {busy ? `${Math.round((progress ?? 0) * 100)}%` : "Download"}
        </button>
      </div>
      {busy && (
        <div className="bar" aria-hidden>
          <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}
