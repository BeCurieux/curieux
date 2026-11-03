"use client";

import { useState, useTransition } from "react";
import { ColourBadge } from "@/components/calc/result";
import { judge, type VerdictFacts } from "@/lib/calc/product-verdict";
import { saveVerdict } from "./actions";

type Answer = boolean | null;

const QUESTIONS = [
  { key: "demand_signal", label: "Have you found a demand signal?" },
  { key: "compliance_done", label: "Is the compliance check done?" },
  {
    key: "cash_covers_first_order",
    label: "Does the cash you have cover the first order's cash need?",
  },
] as const;

export function VerdictForm({ margin, breakEven }: { margin: number; breakEven: number | null }) {
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<(typeof QUESTIONS)[number]["key"], Answer>>({
    demand_signal: null,
    compliance_done: null,
    cash_covers_first_order: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = Object.values(answers).every((a) => a !== null);
  const result = complete
    ? judge({
        margin_pct: margin,
        break_even_units: breakEven,
        ...(answers as Omit<VerdictFacts, "margin_pct" | "break_even_units">),
      })
    : null;

  const save = () =>
    startTransition(async () => {
      const outcome = await saveVerdict({ product_name: name, ...answers });
      if (outcome.status === "saved") {
        setMessage("Verdict saved. It's at the top of your verdicts below.");
        setName("");
        setAnswers({ demand_signal: null, compliance_done: null, cash_covers_first_order: null });
      } else setMessage(outcome.message);
    });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div>
        <label htmlFor="product-name" className="block font-semibold">
          Product
        </label>
        <input
          id="product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          className="border-line bg-paper mt-1 block w-full rounded-xl border px-4 py-3 text-lg"
        />
      </div>
      {QUESTIONS.map((q) => (
        <fieldset key={q.key}>
          <legend className="font-semibold">{q.label}</legend>
          <div className="mt-2 flex gap-3">
            {[true, false].map((option) => (
              <label
                key={String(option)}
                className="border-line bg-paper flex items-center gap-2 rounded-full border px-4 py-2"
              >
                <input
                  type="radio"
                  name={q.key}
                  checked={answers[q.key] === option}
                  onChange={() => setAnswers((a) => ({ ...a, [q.key]: option }))}
                  className="size-5"
                />
                {option ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {result ? (
        <section
          className="border-line bg-paper rounded-2xl border p-5"
          aria-live="polite"
          data-testid="live-verdict"
        >
          <h2 className="flex items-center gap-3 text-2xl">
            Verdict <ColourBadge colour={result.verdict} />
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {result.to_green.length ? (
            <>
              <h3 className="mt-4 text-xl">What would turn it green</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.to_green.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : (
        <p className="text-mute">Answer all three to see the verdict.</p>
      )}

      <button
        type="submit"
        disabled={!result || !name.trim() || pending}
        className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : "Save this verdict"}
      </button>
      {message ? (
        <p role="status" className="font-semibold">
          {message}
        </p>
      ) : null}
    </form>
  );
}
