"use client";

// What your photographs already know.
//
// The free tool, and the reason it is worth building rather than a lead
// magnet with a form on it: **nothing leaves the device.** Not "we delete it
// afterwards", not "it is encrypted in transit" — the files are never read
// and never sent. The browser gives us a filename and a modification time
// from the file picker, we do arithmetic on the times, and that is the whole
// transaction.
//
// That makes it three things at once. A genuinely useful thing somebody can
// use and never come back. A demonstration of the product's actual trick,
// running the actual engine — lib/onboarding/discover.ts, the same module
// that runs inside a real archive, not a marketing imitation of it. And the
// strongest privacy claim available, because it is structural: there is no
// upload to trust us about.
//
// tests/tools.test.ts holds it to that. No fetch, no form action, no server
// action, no FileReader — the last one because reading the bytes is exactly
// the step that would make "we never look at your photographs" a promise
// rather than a fact about the code.
//
// ## The honest part
//
// A file's modification time is usually when the photograph was taken and
// sometimes is not: a copy off a memory card, a download from a shared
// album, a phone that rewrote everything during a migration. The engine
// already knows — looksFake() refuses to say anything when the timestamps
// look synthetic, and hasClockTimes() drops the wording back from "that
// Saturday morning" to "that Saturday" when there is no real clock. Both are
// reused rather than reimplemented, and the page says what it is reading.

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { discoveries, hasClockTimes, looksFake, type Discovery, type Shot } from "@/lib/onboarding/discover";
import { countOf, dateRange, fullDate } from "@/lib/words";
import { BRAND } from "@/lib/brand";

/** How many findings to show. The engine returns all of them, best first. */
const SHOW = 5;

type Verdict =
  | { state: "waiting" }
  | { state: "thin"; count: number }
  | { state: "junk"; count: number }
  | { state: "read"; count: number; from: string; to: string; found: Discovery[]; clock: boolean };

export function WhatYourPhotosKnow() {
  const [verdict, setVerdict] = useState<Verdict>({ state: "waiting" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const read = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    // The only thing taken from each file: its modification time. Not its
    // bytes, not its name, not its size. There is no FileReader in this
    // component and a test checks there never is.
    const shots: Shot[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) continue;
      shots.push({ id: String(i), at: new Date(file.lastModified).toISOString() });
    }

    if (shots.length < 6) {
      setVerdict({ state: "thin", count: shots.length });
      return;
    }
    if (looksFake(shots)) {
      setVerdict({ state: "junk", count: shots.length });
      return;
    }

    const sorted = [...shots].sort((a, b) => a.at.localeCompare(b.at));
    setVerdict({
      state: "read",
      count: shots.length,
      from: sorted[0].at.slice(0, 10),
      to: sorted[sorted.length - 1].at.slice(0, 10),
      found: discoveries(shots).slice(0, SHOW),
      clock: hasClockTimes(shots),
    });
  }, []);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); read(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-clay bg-rule/40" : "border-rule bg-white"
        }`}
      >
        <p className="font-display text-lg">Drop a few hundred photos here</p>
        <p className="mt-1 text-sm text-stone">
          or tap to choose &mdash; nothing is uploaded
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => read(e.target.files)}
        />
      </div>

      {/* Said at the moment of the decision, not in a footer. The claim is
          unusual enough to be worth making precisely. */}
      <p className="mt-4 max-w-[54ch] text-xs leading-relaxed text-stone">
        Your browser gives this page the date each file was last changed. That
        is all it takes and all it uses &mdash; the photographs themselves are
        never opened, never read and never sent anywhere. Close the tab and
        nothing of this existed.
      </p>

      {verdict.state === "thin" && (
        <div className="mt-8 rounded-2xl bg-card p-6">
          <p className="font-display text-lg">Not quite enough to say anything.</p>
          <p className="mt-2 max-w-[50ch] leading-relaxed text-stone">
            {verdict.count === 0
              ? "No photographs with a usable date in that lot."
              : `${countOf(verdict.count, "photograph")}. A few dozen is where patterns start showing up — try a whole month, or a year.`}
          </p>
        </div>
      )}

      {verdict.state === "junk" && (
        <div className="mt-8 rounded-2xl bg-card p-6">
          <p className="font-display text-lg">These dates aren&rsquo;t real dates.</p>
          <p className="reading mt-2 max-w-[52ch] leading-relaxed text-stone">
            Every one of those {countOf(verdict.count, "file")} has the same
            timestamp, or near enough &mdash; which usually means they were
            copied off a card or downloaded from a shared album, and the
            original times were lost on the way. We could invent something
            from it. We would rather say nothing.
          </p>
        </div>
      )}

      {verdict.state === "read" && (
        <div className="mt-10">
          <p className="text-xs uppercase tracking-[0.28em] text-clay">
            {countOf(verdict.count, "photograph")} · {dateRange(verdict.from, verdict.to)}
          </p>

          {verdict.found.length === 0 ? (
            <p className="reading mt-4 max-w-[52ch] leading-relaxed text-stone">
              Nothing stands out in these, which is a real answer rather than a
              failure &mdash; it usually means they are spread evenly, or that
              there is not yet enough of a stretch to see a shape in.
            </p>
          ) : (
            <ul className="mt-6 space-y-7">
              {verdict.found.map((d, i) => (
                <li key={`${d.finding}-${i}`}>
                  <p
                    className={
                      i === 0
                        ? "max-w-[24ch] font-display text-3xl leading-[1.15] md:text-4xl"
                        : "max-w-[40ch] font-display text-xl leading-snug"
                    }
                  >
                    {d.because}
                  </p>
                  {/* The question, which is the actual product. Shown as a
                      question rather than answered, because we cannot know
                      and will not guess. */}
                  {d.ask && (
                    <p className="mt-2 max-w-[46ch] leading-relaxed text-stone">{d.ask}</p>
                  )}
                  <p className="mt-1.5 text-xs text-stone">
                    {d.shotIds.length > 1
                      ? `from ${countOf(d.shotIds.length, "photograph")}, ${dateRange(d.from, d.to)}`
                      : fullDate(d.from)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {!verdict.clock && verdict.found.length > 0 && (
            <p className="mt-8 max-w-[52ch] text-xs leading-relaxed text-stone">
              These files carry dates but not times, so anything above is about
              days rather than mornings and afternoons.
            </p>
          )}

          {/* One offer, after the useful part, and it describes the
              difference honestly: this read the clock, and the product reads
              the year and remembers your answers. */}
          <div className="mt-12 border-t border-rule pt-8">
            <p className="reading max-w-[52ch] leading-relaxed">
              That was arithmetic on timestamps &mdash; no account, nothing
              uploaded, and it is genuinely all this page did. {BRAND} does the
              same thing to a whole year, keeps the photographs, and remembers
              what you answer, so the questions above become the part of the
              record nobody can work out later.
            </p>
            <p className="mt-5">
              <Link href="/pricing" className="btn !px-6 !py-3">What that costs</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
