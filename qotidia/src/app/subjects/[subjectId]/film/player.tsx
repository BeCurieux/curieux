"use client";

// Playing the cut.
//
// The edit is decided in lib/film/cut.ts and this only runs it: hold each
// frame for its own duration, cross-fade between them, stop at the end.
// Keeping the two apart matters more than it looks — the same cut has to
// play identically here and in whatever encodes an actual file later, and
// an edit that lives inside a React component cannot be reused or tested.
//
// Deliberately not a video element and deliberately not autoplaying. A film
// about somebody's child should start because they pressed play.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cut, Frame } from "@/lib/film/cut";

/** Long enough to read as a dissolve rather than a cut. */
const FADE_MS = 700;

export function FilmPlayer({
  cut,
  photos,
}: {
  cut: Cut;
  /** Signed URLs by memory id. Resolved server-side; short-lived. */
  photos: Record<string, string>;
}) {
  const [at, setAt] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!playing) return;
    if (at >= cut.frames.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setAt((i) => i + 1), cut.frames[Math.max(0, at)].ms);
    return stop;
  }, [playing, at, cut.frames, stop]);

  const start = () => {
    setAt(0);
    setPlaying(true);
  };

  const done = !playing && at >= cut.frames.length - 1;
  const frame: Frame | null = at >= 0 ? cut.frames[at] : null;

  // Every photograph is mounted from the start and faded, rather than
  // swapped in on cue. A browser that fetches the next image when it is
  // needed shows a blank frame on a slow connection, which in a
  // sixty-second film is most of it.
  const stills = cut.frames
    .map((f, i) => (f.kind === "photo" ? { i, url: photos[f.id] } : null))
    .filter((s): s is { i: number; url: string } => Boolean(s?.url));

  return (
    <div>
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-ink">
        {stills.map(({ i, url }) => (
          <img
            key={i}
            src={url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover transition-opacity"
            style={{ opacity: at === i ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
          />
        ))}

        {/* Words sit on the ground rather than over a photograph. A caption
            burned across somebody's child is a stock-video habit. */}
        {frame && frame.kind !== "photo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink px-8 text-center">
            {frame.kind === "card" ? (
              <p className="max-w-[26ch] font-display text-2xl leading-snug text-paper md:text-4xl">
                {frame.text}
              </p>
            ) : (
              <>
                <p className="font-display text-4xl text-paper md:text-6xl">{frame.text}</p>
                <p className="mt-4 text-sm text-paper/70">{frame.sub}</p>
              </>
            )}
          </div>
        )}

        {(at < 0 || done) && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
            <button onClick={start} className="btn !px-8 !py-4">
              {done ? "Play it again" : "Play"}
            </button>
          </div>
        )}
      </div>

      {/* A line, not a scrubber. This is sixty seconds; a timeline with a
          handle invites somebody to skim a year. */}
      <div className="mt-3 h-px w-full bg-rule">
        <div
          className="h-px bg-clay transition-[width] duration-300"
          style={{ width: `${at < 0 ? 0 : ((at + 1) / cut.frames.length) * 100}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-stone">
        {Math.round(cut.totalMs / 1000)} seconds &middot;{" "}
        {cut.frames.filter((f) => f.kind === "photo").length} of {cut.fromPhotos} photographs
        &middot; no sound
      </p>
    </div>
  );
}
