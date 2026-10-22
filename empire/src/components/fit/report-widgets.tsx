"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveFitProgress } from "@/app/studio/fit/actions";
import { calcCore, type PlanDay, type Scored } from "@/lib/fit/engine";
import type { FitProgress } from "@/lib/domain/records";

// The report's two interactive parts — the calculator and the dated 14-day
// plan — with her inputs saved to her account as she goes. The calculator
// uses the engine's own calcCore(), so browser and tests run the same maths.

type Calc = { price?: number; hrs?: number; cost?: number; fixed?: number; start?: number };

function useSaver(resultId: string) {
  const pending = useRef<Partial<FitProgress> | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    const send = pending.current;
    if (!send) return;
    pending.current = null;
    startTransition(async () => {
      const result = await saveFitProgress(resultId, send);
      setState(result.ok ? (pending.current ? "saving" : "saved") : "error");
    });
  };

  // Sends only what changed; the server merges it into her saved progress.
  // "Saving…" shows from the first keystroke, so "Saved" is never shown
  // while a change is still waiting to go.
  const save = (patch: Partial<FitProgress>, delay = 400) => {
    const prev = pending.current ?? {};
    pending.current = {
      ...prev,
      ...patch,
      ...(patch.calc ? { calc: { ...(prev.calc ?? {}), ...patch.calc } } : {}),
    };
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };

  // Leaving the page (or this section) sends anything still waiting.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  return { save, state };
}

function Status({ state, id }: { state: string; id: string }) {
  return (
    <p id={id} aria-live="polite" className="text-mute h-5 text-xs">
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved to your account"
          : state === "error"
            ? "Couldn't save — check your connection."
            : ""}
    </p>
  );
}

const money = (sym: string, v: number) => sym + Math.round(v).toLocaleString("en");

export function Calculator({
  resultId,
  progress,
  scored,
  unit,
  sym,
  weeklyHours,
  floor,
}: {
  resultId: string;
  progress: FitProgress;
  scored: Pick<Scored, "cap"> & { o: { id: number; verify: string } };
  unit: string;
  sym: string;
  weeklyHours: number;
  floor: number;
}) {
  const id = String(scored.o.id);
  const { save, state } = useSaver(resultId);
  const [c, setC] = useState<Calc>(progress.calc?.[id] ?? { start: scored.cap, cost: 0, fixed: 0 });

  const update = (k: keyof Calc, v: string) => {
    const next = { ...c, [k]: v === "" ? undefined : Math.max(0, Number(v)) };
    setC(next);
    save({ calc: { [id]: next } });
  };

  const result = calcCore(c, weeklyHours, floor, unit, sym);
  const field = (k: keyof Calc, label: string, hint?: string, step = "1") => (
    <div className="space-y-1">
      <label htmlFor={`calc-${k}`} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={`calc-${k}`}
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        value={c[k] ?? ""}
        onChange={(e) => update(k, e.target.value)}
        className="field-input"
        aria-describedby={hint ? `calc-${k}-hint` : undefined}
      />
      {hint ? (
        <p id={`calc-${k}-hint`} className="text-mute text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {field(
          "price",
          `Price per ${unit} (${sym})`,
          `From your Day 5 research. Check before you rely on it: ${scored.o.verify}`,
        )}
        {field("hrs", `Hours per ${unit}, incl. admin`, undefined, "0.25")}
        {field(
          "cost",
          `Costs per ${unit} (${sym})`,
          "Materials, postage, platform and payment fees.",
        )}
        {field("fixed", `Monthly running costs (${sym})`, "Software, subscriptions, insurance.")}
        {field(
          "start",
          `Start-up cost (${sym})`,
          "Prefilled with our estimate (EST) for your country. Change it to your real number.",
        )}
        <Status state={state} id="calc-status" />
      </div>
      <div className="border-line bg-ivory rounded-2xl border p-5" aria-live="polite">
        {!result ? (
          <p className="text-mute">
            Enter your price and hours per {unit} to see your break-even, your real hourly return
            and three scenarios. Nothing is filled in for you, because a made-up price would be a
            made-up result.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="flex justify-between gap-2">
              <span>Earned per {unit} after costs</span>
              <b>{money(sym, result.margin)}</b>
            </p>
            <p className="flex justify-between gap-2">
              <span>{unit[0]!.toUpperCase() + unit.slice(1)}s to win back your start-up</span>
              <b>{result.breakEven === null ? "never at this price" : result.breakEven}</b>
            </p>
            <p className="flex justify-between gap-2">
              <span>Most you could do a month in {weeklyHours} hrs/week</span>
              <b>{result.capacity}</b>
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-mute">
                  <th className="py-1 font-medium">Busy</th>
                  <th className="py-1 text-right font-medium">Sold / mo</th>
                  <th className="py-1 text-right font-medium">Profit / mo</th>
                  <th className="py-1 text-right font-medium">Per hr</th>
                </tr>
              </thead>
              <tbody>
                {result.scenarios.map((x) => (
                  <tr key={x.f} className="border-line border-t">
                    <td className="py-1">{x.f * 100}%</td>
                    <td className="py-1 text-right">{x.n}</td>
                    <td className="py-1 text-right">{money(sym, x.p)}</td>
                    <td className="py-1 text-right">{money(sym, x.h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              className={`rounded-xl p-3 font-medium ${result.signal === "ok" ? "text-success bg-[#eef6f0]" : result.signal === "only-full" ? "text-warning bg-[#fbf3e2]" : "text-danger bg-[#fbeeee]"}`}
            >
              {result.message}
            </p>
            <p className="text-mute text-xs">
              "Busy" is the share of your {weeklyHours} weekly hours spent on paid work. Before tax.
              A scenario from your inputs, not a forecast. "Per hour" spreads profit over all{" "}
              {weeklyHours} of your weekly hours, because unpaid hours spent finding customers are
              still your hours.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function PlanTracker({
  resultId,
  progress,
  days,
  short,
}: {
  resultId: string;
  progress: FitProgress;
  days: PlanDay[];
  short: boolean;
}) {
  const { save, state } = useSaver(resultId);
  const [start, setStart] = useState(progress.start ?? iso(new Date()));
  const [done, setDone] = useState<number[]>(progress.done ?? []);
  const dateOf = (d: number) => {
    const x = new Date(`${start}T00:00:00`);
    x.setDate(x.getDate() + d - 1);
    return x.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  };
  return (
    <div className="space-y-4">
      <p className="text-mute">
        Each day is one{" "}
        {short ? "short stretch of 30-60 minutes" : "of your working blocks, or less"}. Miss a day?
        Don't double up, just carry on.{" "}
        <label htmlFor="fit-start" className="text-charcoal font-semibold">
          Start date:
        </label>{" "}
        <input
          id="fit-start"
          type="date"
          value={start}
          onChange={(e) => (setStart(e.target.value), save({ start: e.target.value }, 0))}
          className="field-input inline-block w-auto py-1"
        />
      </p>
      <ol className="space-y-2">
        {days.map((p) => (
          <li
            key={p.d}
            className={`flex gap-4 rounded-2xl border p-4 ${p.ms ? "border-aubergine bg-blush-soft" : "border-line bg-paper"}`}
          >
            <div className="w-16 shrink-0">
              <p className="font-num text-aubergine text-2xl">
                {p.d === 1 ? "1–3" : String(p.d).padStart(2, "0")}
              </p>
              <p className="text-mute text-xs">{dateOf(p.d)}</p>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">{p.t}</h4>
              <p className="text-mute mt-1 text-sm">{p.txt}</p>
            </div>
            <input
              type="checkbox"
              aria-label={`Day ${p.d} done`}
              checked={done.includes(p.d)}
              onChange={(e) => {
                const next = e.target.checked ? [...done, p.d] : done.filter((x) => x !== p.d);
                setDone(next);
                save({ done: next }, 0);
              }}
              className="accent-aubergine mt-1 size-6"
            />
          </li>
        ))}
      </ol>
      <Status state={state} id="plan-status" />
    </div>
  );
}
