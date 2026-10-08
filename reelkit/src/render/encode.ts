/**
 * Encoding an ad to a video file, in the seller's browser.
 *
 * Rendering here rather than on a server is the cost decision this product
 * rests on: a server render is CPU-seconds per video, paid by us, for every
 * preview a seller tweaks. In the browser it is free, private (their photos
 * never leave their machine once loaded) and as fast as their laptop.
 *
 * H.264 in MP4 first, because every ad platform takes it. Browsers that
 * cannot encode H.264 fall back to VP9 in WebM, which TikTok and Meta accept
 * less reliably — the UI says so when that happens.
 */

import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from "mediabunny";
import { drawFrame, DEFAULT_THEME, type Ctx, type EndCard, type Picture, type Theme } from "./draw.js";
import { FPS, type Format } from "./formats.js";
import { buildTimeline, frameAt } from "./timeline.js";
import type { AdScript } from "../script/types.js";

export type Rendered = { blob: Blob; extension: "mp4" | "webm"; seconds: number };

export class CannotEncode extends Error {}

export async function encodeAd(opts: {
  script: AdScript;
  pictures: Picture[];
  format: Format;
  card: EndCard;
  theme?: Theme;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<Rendered> {
  const { format: f } = opts;
  const timeline = buildTimeline(opts.script);

  const size = { width: f.w, height: f.h, quality: QUALITY_HIGH, frameRate: FPS };
  let codec = await getFirstEncodableVideoCodec(["avc"], size);
  let mp4 = true;
  if (!codec) {
    codec = await getFirstEncodableVideoCodec(["vp9", "vp8"], size);
    mp4 = false;
  }
  if (!codec) throw new CannotEncode("This browser can't encode video. Try the latest Chrome, Edge or Safari.");

  const canvas = new OffscreenCanvas(f.w, f.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx | null;
  if (!ctx) throw new CannotEncode("This browser can't draw to an offscreen canvas.");

  const output = new Output({
    format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 1 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const frames = Math.ceil(timeline.duration * FPS);
  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const t = i / FPS;
      drawFrame(ctx, frameAt(timeline, t), opts.pictures, f, opts.card, opts.theme ?? DEFAULT_THEME);
      await source.add(t, 1 / FPS);
      if (i % 10 === 0) opts.onProgress?.(i / frames);
    }
    await output.finalize();
  } catch (e) {
    await output.cancel();
    throw e;
  }
  opts.onProgress?.(1);

  const buffer = output.target.buffer;
  if (!buffer) throw new CannotEncode("The encoder finished without producing a file.");
  return {
    blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }),
    extension: mp4 ? "mp4" : "webm",
    seconds: timeline.duration,
  };
}
