"use client";

// The result screen (brief §19).
//
// "Do not merely display $165." The number is the headline, but the card
// around it is what makes a quote feel like an answer rather than an output:
// a heading in the customer's language, the reassurances the business would
// have said out loud, an honest breakdown, and one obvious next step.

import { useState } from "react";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, RefreshIcon } from "@/components/ui/Icons";
import type { WidgetEvaluation } from "@/lib/widget/engine";
import { formatValue } from "@/lib/widget/format";
import type { IllustrationKey } from "@/lib/widget/illustrations";
import type { ResultConfig } from "@/lib/widget/schema";

interface ResultViewProps {
  result: ResultConfig;
  evaluation: WidgetEvaluation;
  /** Falls back to the widget's own illustration when an outcome has none. */
  illustration?: IllustrationKey;
  onCtaClick: () => void;
  onRestart: () => void;
  /** Rendered under the actions — the lead form, when capture is "after". */
  children?: React.ReactNode;
}

export function ResultView({
  result,
  evaluation,
  illustration,
  onCtaClick,
  onRestart,
  children,
}: ResultViewProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const outcome = evaluation.outcome;
  const showsNumber = result.kind !== "recommendation";
  const cta = outcome?.cta ?? result.cta;
  const bullets = outcome?.bullets?.length ? outcome.bullets : evaluation.bullets;
  const hasBreakdown = result.showBreakdown && evaluation.breakdown.length > 0;
  // Most specific first: the winning outcome's own art, then the result's,
  // then whatever the widget introduced itself with.
  const art = outcome?.illustration ?? result.illustration ?? illustration;

  return (
    <div className="qw-screen mx-auto w-full max-w-xl" data-direction="result">
      {/* The result is the happy ending, so it gets its own colour rather than
          another wash of the brand accent — mint by default, per theme. */}
      <div
        className="qw-surface relative overflow-hidden"
        style={{ background: "var(--w-celebrate)", borderColor: "var(--w-celebrate-border)" }}
      >
        <Confetti />

        <div className="relative px-6 py-8 text-center sm:px-10">
          {art ? (
            <div className="mb-3 flex justify-center">
              <Illustration name={art} size={78} />
            </div>
          ) : null}

          <p className="qw-muted text-sm font-semibold">{evaluation.heading}</p>

          {showsNumber ? (
            // A range is roughly twice as wide as a single figure, so it gets
            // its own scale rather than wrapping across two lines.
            <p
              className="mt-2 font-bold leading-none tracking-tight"
              style={{
                // "$1,240" is six characters; "$170–$204" is nine. Anything
                // past seven is a range or a big number and needs the room.
                fontSize:
                  evaluation.display.length > 7
                    ? "clamp(1.5rem, 5.4cqw, 2.5rem)"
                    : "clamp(2.25rem, 9cqw, 3.5rem)",
              }}
            >
              {evaluation.display}
            </p>
          ) : null}

          {outcome ? (
            <p
              className={`font-bold tracking-tight ${
                showsNumber ? "mt-3 text-xl" : "mt-2 text-[clamp(1.75rem,7cqw,2.5rem)] leading-tight"
              }`}
            >
              {outcome.title}
            </p>
          ) : null}

          {outcome?.description ? (
            <p className="qw-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
              {outcome.description}
            </p>
          ) : null}

          {evaluation.description ? (
            <p className="qw-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
              {evaluation.description}
            </p>
          ) : null}

          {evaluation.messages.length > 0 ? (
            <ul className="qw-muted mx-auto mt-3 max-w-md space-y-1 text-sm">
              {evaluation.messages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {bullets.length > 0 ? (
          <ul
            className="relative grid gap-2 px-6 pb-7 text-left sm:px-10"
            style={{ borderTop: "1px solid var(--w-celebrate-border)", paddingTop: "20px" }}
          >
            {bullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2.5 text-sm font-medium">
                <span
                  className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full"
                  style={{ background: "var(--w-celebrate-strong)", color: "#FFFFFF" }}
                >
                  <CheckIcon size={12} strokeWidth={3} />
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3">
        {cta ? (
          <button type="button" className="qw-btn w-full" onClick={onCtaClick}>
            {cta.label}
            <ArrowRightIcon size={18} />
          </button>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-1">
          {hasBreakdown ? (
            <button
              type="button"
              className="qw-btn-quiet text-sm"
              aria-expanded={showBreakdown}
              onClick={() => setShowBreakdown((open) => !open)}
            >
              {showBreakdown ? "Hide" : "See"} breakdown
              <ChevronDownIcon
                size={16}
                className={`transition-transform ${showBreakdown ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}

          <button type="button" className="qw-btn-quiet text-sm" onClick={onRestart}>
            <RefreshIcon size={16} />
            Start again
          </button>
        </div>
      </div>

      {showBreakdown && hasBreakdown ? (
        <div className="qw-surface mt-3 overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--w-border)" }}>
            {evaluation.breakdown.map((line, index) => (
              <li key={index} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="qw-muted">{line.label}</span>
                <span className="font-semibold tabular-nums">
                  {line.amount < 0 ? "−" : ""}
                  {formatValue(Math.abs(line.amount), result.format)}
                </span>
              </li>
            ))}
            <li
              className="flex items-center justify-between gap-4 px-5 py-3 text-sm font-bold"
              style={{ background: "var(--w-panel)" }}
            >
              <span>Total</span>
              <span className="tabular-nums">{evaluation.display}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {children}

      {result.disclaimer ? (
        <p className="qw-faint mt-5 text-center text-xs leading-relaxed">{result.disclaimer}</p>
      ) : null}
    </div>
  );
}

/**
 * A few scattered marks in the corners of the result card.
 *
 * §38 rules out confetti *animation* as distracting, and it's right — but a
 * still, quiet scatter is what makes the card read as an arrival rather than
 * an output. Decorative only, and it inherits the theme's colours.
 */
function Confetti() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
      viewBox="0 0 400 220"
      fill="none"
    >
      <g stroke="var(--w-celebrate-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.35">
        <path d="M28 30l7-8M46 52l9-3M22 62l3 9" />
        <path d="M370 40l-8-7M348 66l-3 9M382 74l-9 2" />
      </g>
      <g fill="var(--w-accent)" opacity="0.22">
        <circle cx="58" cy="26" r="3.5" />
        <circle cx="356" cy="24" r="3" />
        <circle cx="20" cy="96" r="2.5" />
        <circle cx="386" cy="104" r="2.5" />
      </g>
    </svg>
  );
}
