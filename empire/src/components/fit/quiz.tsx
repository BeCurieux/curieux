"use client";

import { useEffect, useState, useTransition } from "react";
import { submitFitAnswers } from "@/app/studio/fit/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { COUNTRIES } from "@/lib/fit/data";
import { QUESTIONS } from "@/lib/fit/questions";

// The Fit Finder quiz, one question at a time, as in the kit's report.
// Answers are kept in this browser until she submits, so a refresh or a
// school run doesn't lose them.

const KEY = "empire-fit-quiz-v1";
type A = Record<string, string | number>;

export function FitQuiz() {
  const [a, setA] = useState<A>({});
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { a: A; i: number } | null;
      if (saved) {
        // Restoring saved progress from this browser after mount (storage
        // isn't available during server rendering).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setA(saved.a);
        setI(Math.min(saved.i, QUESTIONS.length - 1));
      }
    } catch {
      // Private window or blocked storage: start fresh.
    }
  }, []);

  const save = (next: A, at: number) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ a: next, i: at }));
    } catch {
      // Storage unavailable; the quiz still works.
    }
  };

  const q = QUESTIONS[i]!;
  const sym = (COUNTRIES.find((c) => c[0] === a.country) ?? COUNTRIES[0])[1];
  const value = a[q.k] ?? (q.t === "num" ? q.default : undefined);
  const answered = q.t !== "choice" || q.optional || a[q.k] !== undefined;
  const last = i === QUESTIONS.length - 1;

  const set = (v: string | number) => {
    const next = { ...a, [q.k]: v };
    setA(next);
    save(next, i);
  };

  const go = (d: number) => {
    let next = a;
    if (d > 0 && q.t === "num" && a[q.k] === undefined) next = { ...a, [q.k]: q.default ?? 0 };
    if (d > 0 && q.optional && a[q.k] === undefined) next = { ...a, [q.k]: "" };
    setA(next);
    if (d > 0 && last) {
      setError(null);
      startTransition(async () => {
        const result = await submitFitAnswers(next);
        if (result && !result.ok) {
          setError(result.message);
          return;
        }
        try {
          localStorage.removeItem(KEY);
        } catch {
          // Nothing to clear.
        }
      });
      return;
    }
    const at = Math.max(0, Math.min(QUESTIONS.length - 1, i + d));
    setI(at);
    save(next, at);
  };

  const unit = q.unit === "cur" ? sym : q.unit === "cur/hr" ? `${sym} an hour` : q.unit;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          {i + 1} of {QUESTIONS.length}
        </p>
        <div className="bg-blush-soft mt-2 h-1.5 rounded-full" aria-hidden>
          <div
            className="bg-aubergine h-1.5 rounded-full transition-all"
            style={{ width: `${Math.round(((i + 1) / QUESTIONS.length) * 100)}%` }}
          />
        </div>
      </div>
      <fieldset>
        <legend className="text-aubergine font-serif text-3xl">{q.q}</legend>
        {q.h ? <p className="text-mute mt-2">{q.h}</p> : null}
        <div className="mt-6">
          {q.t === "choice" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {q.o!.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={a[q.k] === o}
                  onClick={() => set(o)}
                  className={`min-h-12 rounded-2xl border px-4 py-3 text-left ${
                    a[q.k] === o
                      ? "border-aubergine bg-aubergine text-ivory"
                      : "border-line bg-paper text-charcoal hover:border-aubergine"
                  }`}
                >
                  <span className="font-semibold">{q.lab?.[o] ?? o}</span>
                  {q.sub?.[o] ? (
                    <span className={`block text-sm ${a[q.k] === o ? "text-blush" : "text-mute"}`}>
                      {q.sub[o]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : q.t === "num" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="fit-num" className="sr-only">
                  {q.q}
                </label>
                <input
                  id="fit-num"
                  type="number"
                  inputMode="numeric"
                  min={q.min}
                  max={q.max}
                  step={q.step ?? 1}
                  value={Number(value ?? 0)}
                  onChange={(e) =>
                    set(Math.max(q.min ?? 0, Math.min(q.max ?? 1e6, Number(e.target.value) || 0)))
                  }
                  className="field-input max-w-36 text-lg"
                />
                <span className="text-mute">{unit}</span>
              </div>
              <input
                type="range"
                aria-label={q.q}
                min={q.min}
                max={q.rangeMax ?? q.max}
                step={q.step ?? 1}
                value={Math.min(Number(value ?? 0), q.rangeMax ?? q.max ?? 0)}
                onChange={(e) => set(Number(e.target.value))}
                className="accent-aubergine w-full"
              />
            </div>
          ) : (
            <>
              <label htmlFor="fit-text" className="sr-only">
                {q.q}
              </label>
              <input
                id="fit-text"
                maxLength={30}
                autoComplete="given-name"
                placeholder="First name"
                value={String(value ?? "")}
                onChange={(e) => set(e.target.value)}
                className="field-input max-w-sm"
              />
            </>
          )}
        </div>
      </fieldset>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="border-line flex items-center gap-3 border-t pt-5">
        {i > 0 ? (
          <Button type="button" variant="secondary" onClick={() => go(-1)}>
            Back
          </Button>
        ) : null}
        <Button type="button" onClick={() => go(1)} disabled={!answered || pending}>
          {pending ? "Building your report…" : last ? "Build my report →" : "Next →"}
        </Button>
      </div>
    </div>
  );
}
