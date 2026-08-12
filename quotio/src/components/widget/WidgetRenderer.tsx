"use client";

// The widget runtime UI (brief §44, phase 2).
//
// One component renders every surface a widget ever appears on: the builder's
// live preview, the hosted page, the embedded iframe and the marketing site's
// hero demo. There is no "preview version" that drifts from the real thing —
// §15's promise that you always see exactly what visitors see is structural,
// not a discipline someone has to maintain.
//
// The differences between surfaces are three booleans: whether events are
// recorded, whether leads are posted, and whether the badge shows.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepInput } from "./Inputs";
import { LeadForm, type LeadValues } from "./LeadForm";
import { ResultView } from "./ResultView";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { StepGlyph } from "./StepGlyph";
import { brand } from "@/config/brand";
import { createTracker, noopTracker } from "@/lib/analytics/client";
import { defaultAnswers, evaluateWidget, isAnswered, visibleSteps, type Answers } from "@/lib/widget/engine";
import type { Widget } from "@/lib/widget/schema";
import { resolveChosen } from "@/lib/widget/selection";
import { widgetStyleVars } from "@/lib/widget/themes";

type Phase = "intro" | "steps" | "lead" | "result";
type Direction = "forward" | "back" | "result";

export interface WidgetRendererProps {
  widget: Widget;
  /** Record analytics and persist leads. Off for previews and templates. */
  live?: boolean;
  /** The "Made with" badge (§22). Plan-gated by the caller. */
  showBadge?: boolean;
  /** The builder drives the preview to whichever step is being edited (§15). */
  activeStepId?: string | null;
  /**
   * Which question to open on. Unlike `activeStepId` this is a starting point,
   * not a leash — the visitor can move freely afterwards. The homepage uses it
   * so the hero opens on a question worth looking at rather than whichever one
   * happens to be first.
   */
  initialStepId?: string;
  /**
   * Answers to start with. Used by the marketing demos so a widget shows
   * itself mid-conversation — a screenshot whose only control is a greyed-out
   * Continue button sells nothing.
   */
  initialAnswers?: Answers;
  /** Where the badge sends people. Defaults to the marketing site. */
  badgeHref?: string;
  className?: string;
}

export function WidgetRenderer({
  widget,
  live = false,
  showBadge = true,
  activeStepId,
  initialStepId,
  initialAnswers,
  badgeHref = "/?from=badge",
  className,
}: WidgetRendererProps) {
  const [answers, setAnswers] = useState<Answers>(() => ({
    ...defaultAnswers(widget),
    ...initialAnswers,
  }));
  /**
   * Which answer card was clicked, per step. Kept beside the answers rather
   * than inside them: the engine wants values, the highlight wants identity,
   * and two answers may share a value on purpose ("Not sure" prices as a
   * 2-bedroom). Lives here, not in the input, so it survives going Back.
   */
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    resolveChosen(widget.steps, initialAnswers)
  );
  const [phase, setPhase] = useState<Phase>(() => (widget.intro ? "intro" : "steps"));
  const [stepIndex, setStepIndex] = useState(() => {
    if (!initialStepId) return 0;
    const index = widget.steps.filter((step) => !step.hidden).findIndex((step) => step.id === initialStepId);
    return index >= 0 ? index : 0;
  });
  const [direction, setDirection] = useState<Direction>("forward");
  const [leadState, setLeadState] = useState<"idle" | "sending" | "done" | "skipped">("idle");

  const tracker = useMemo(
    () => (live ? createTracker(widget.id) : noopTracker),
    [live, widget.id]
  );

  const steps = useMemo(() => visibleSteps(widget, answers), [widget, answers]);
  const evaluation = useMemo(() => evaluateWidget(widget, answers), [widget, answers]);
  const style = useMemo(() => widgetStyleVars(widget.theme), [widget.theme]);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAdvance = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };
  useEffect(() => clearAdvance, []);

  useEffect(() => {
    tracker.track("widget_view");
  }, [tracker]);

  // The builder previews whatever the editor has selected. Answers are kept,
  // so nudging a question's wording doesn't wipe the visitor's progress (§15).
  useEffect(() => {
    if (activeStepId === undefined) return;
    if (activeStepId === null) {
      setPhase("result");
      setDirection("result");
      return;
    }
    if (activeStepId === "__intro__") {
      setPhase("intro");
      return;
    }
    const index = steps.findIndex((step) => step.id === activeStepId);
    if (index >= 0) {
      setPhase("steps");
      setStepIndex(index);
    }
  }, [activeStepId, steps]);

  // Branching can remove the step you're standing on. Don't fall off the end.
  useEffect(() => {
    if (phase === "steps" && stepIndex >= steps.length && steps.length > 0) {
      setStepIndex(steps.length - 1);
    }
  }, [phase, stepIndex, steps.length]);

  const currentStep = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
  const answered = currentStep ? isAnswered(currentStep, answers) : true;

  const setAnswer = useCallback(
    (stepId: string, value: unknown) => {
      tracker.track("widget_start");
      setAnswers((old) => ({ ...old, [stepId]: value }));
    },
    [tracker]
  );

  const goToResult = useCallback(() => {
    clearAdvance();
    setDirection("result");
    if (widget.settings.leadCapture.mode === "before" && leadState === "idle") {
      setPhase("lead");
      return;
    }
    tracker.track("widget_complete", {
      metadata: { value: Math.round(evaluation.value * 100) / 100 },
    });
    tracker.track("result_view");
    setPhase("result");
  }, [evaluation.value, leadState, tracker, widget.settings.leadCapture.mode]);

  const goNext = useCallback(() => {
    clearAdvance();
    if (currentStep) tracker.track("step_complete", { stepId: currentStep.id });
    if (stepIndex >= steps.length - 1) {
      goToResult();
      return;
    }
    setDirection("forward");
    setStepIndex((index) => index + 1);
  }, [currentStep, goToResult, stepIndex, steps.length, tracker]);

  const goBack = useCallback(() => {
    clearAdvance();
    setDirection("back");
    if (phase === "lead") {
      setPhase("steps");
      return;
    }
    if (stepIndex === 0) {
      if (widget.intro) setPhase("intro");
      return;
    }
    setStepIndex((index) => index - 1);
  }, [phase, stepIndex, widget.intro]);

  const restart = useCallback(() => {
    clearAdvance();
    setAnswers({ ...defaultAnswers(widget), ...initialAnswers });
    setChosen(resolveChosen(widget.steps, initialAnswers));
    setLeadState("idle");
    setStepIndex(0);
    setDirection("back");
    setPhase(widget.intro ? "intro" : "steps");
  }, [widget, initialAnswers]);

  /** Auto-advance after a single-choice answer, once the tick has landed. */
  const commitAndAdvance = useCallback(() => {
    clearAdvance();
    advanceTimer.current = setTimeout(() => goNext(), 260);
  }, [goNext]);

  const submitLead = useCallback(
    async (values: LeadValues) => {
      setLeadState("sending");
      tracker.track("lead_submit");

      if (live) {
        try {
          await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ widgetId: widget.id, ...values, answers }),
          });
        } catch {
          // A failed lead post must not cost the visitor their result.
        }
      }

      setLeadState("done");
      if (phase === "lead") {
        tracker.track("widget_complete");
        tracker.track("result_view");
        setPhase("result");
      }
    },
    [answers, live, phase, tracker, widget.id]
  );

  const skipLead = useCallback(() => {
    setLeadState("skipped");
    if (phase === "lead") {
      tracker.track("widget_complete");
      tracker.track("result_view");
      setDirection("result");
      setPhase("result");
    }
  }, [phase, tracker]);

  const handleCta = useCallback(() => {
    const url = evaluation.outcome?.cta?.url ?? widget.result.cta?.url;
    tracker.track("cta_click", {
      metadata: { label: evaluation.outcome?.cta?.label ?? widget.result.cta?.label ?? "" },
    });
    if (url && /^https?:\/\//i.test(url) && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [evaluation.outcome, tracker, widget.result.cta]);

  const badge = showBadge ? (
    <a
      className="qw-badge"
      href={badgeHref}
      target="_blank"
      rel="noopener noreferrer"
      title={`Like this widget? Make your own with ${brand.name}.`}
    >
      {brand.badgeLabel} <strong>{brand.name}</strong>
      <span aria-hidden="true">✦</span>
    </a>
  ) : null;

  const stepNumber = steps.findIndex((step) => step.id === currentStep?.id) + 1;
  const progress =
    phase === "result" ? 1 : steps.length === 0 ? 0 : Math.max(0, stepNumber - 1) / steps.length;

  return (
    <div className={`qw ${className ?? ""}`} style={style as React.CSSProperties}>
      <div className="qw-layout">
        {widget.settings.showProgress ? (
          <Rail
            name={widget.name}
            steps={steps}
            currentId={currentStep?.id}
            phase={phase}
            progress={progress}
            stepNumber={stepNumber}
            logoUrl={widget.theme.logoUrl}
            onJump={(index) => {
              clearAdvance();
              setDirection(index < stepIndex ? "back" : "forward");
              setPhase("steps");
              setStepIndex(index);
            }}
            isReachable={(index) => index <= stepIndex || phase === "result"}
            badge={badge}
          />
        ) : null}

        <div className="qw-main">
          {phase === "intro" && widget.intro ? (
            <div className="qw-screen mx-auto max-w-lg py-6 text-center" data-direction={direction}>
              {widget.intro.illustration ? (
                <div className="mb-4 flex justify-center">
                  <Illustration name={widget.intro.illustration} size={88} />
                </div>
              ) : null}
              <h2 className="text-[clamp(1.5rem,5cqw,2rem)] font-bold leading-tight tracking-tight">
                {widget.intro.heading}
              </h2>
              {widget.intro.description ? (
                <p className="qw-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
                  {widget.intro.description}
                </p>
              ) : null}
              <button
                type="button"
                className="qw-btn mt-6"
                onClick={() => {
                  tracker.track("widget_start");
                  setDirection("forward");
                  setPhase("steps");
                }}
              >
                {widget.intro.buttonLabel}
                <ArrowRightIcon size={18} />
              </button>
            </div>
          ) : null}

          {phase === "steps" && currentStep ? (
            <div className="qw-screen" data-direction={direction} key={currentStep.id}>
              <fieldset className="border-0 p-0">
                <legend id={`${widget.id}-${currentStep.id}-label`} className="w-full">
                  <span className="qw-faint text-xs font-bold uppercase tracking-wider">
                    {currentStep.id.replace(/_/g, " ")}
                  </span>
                  <span className="mt-1 block text-[clamp(1.25rem,4.5cqw,1.75rem)] font-bold leading-tight tracking-tight">
                    {currentStep.title}
                  </span>
                  {currentStep.description ? (
                    <span className="qw-muted mt-1.5 block text-sm leading-relaxed">
                      {currentStep.description}
                    </span>
                  ) : null}
                </legend>

                <div className="mt-5">
                  <StepInput
                    step={currentStep}
                    value={answers[currentStep.id]}
                    namespace={widget.id}
                    onChange={(value) => setAnswer(currentStep.id, value)}
                    onCommit={commitAndAdvance}
                    chosenIds={chosen[currentStep.id]}
                    onChoose={(ids) =>
                      setChosen((current) => ({ ...current, [currentStep.id]: ids }))
                    }
                  />
                </div>
              </fieldset>

              <div className="mt-7 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="qw-btn-quiet"
                  onClick={goBack}
                  disabled={stepIndex === 0 && !widget.intro}
                  style={stepIndex === 0 && !widget.intro ? { visibility: "hidden" } : undefined}
                >
                  <ArrowLeftIcon size={16} />
                  Back
                </button>

                <button type="button" className="qw-btn" onClick={goNext} disabled={!answered}>
                  {stepIndex >= steps.length - 1 ? "See my result" : "Continue"}
                  <ArrowRightIcon size={18} />
                </button>
              </div>

              {!answered && currentStep.required ? (
                <p className="qw-faint mt-3 text-right text-xs">
                  {currentStep.input.kind === "email"
                    ? "Pop in a valid email to continue."
                    : "Pick an answer to continue."}
                </p>
              ) : null}

              {/* Said up front, where it reassures, rather than only next to
                  the form where it reads as a disclaimer. */}
              {widget.settings.leadCapture.mode !== "none" ? (
                <p className="qw-faint mt-6 flex items-center gap-1.5 text-xs">
                  <ShieldIcon />
                  {widget.settings.privacyNote}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "lead" ? (
            <div className="qw-screen py-4" data-direction={direction}>
              <LeadForm
                variant="before"
                settings={widget.settings.leadCapture}
                privacyNote={widget.settings.privacyNote}
                submitting={leadState === "sending"}
                onSubmit={submitLead}
                onSkip={skipLead}
              />
              <div className="mt-4 flex justify-center">
                <button type="button" className="qw-btn-quiet text-sm" onClick={goBack}>
                  <ArrowLeftIcon size={16} />
                  Back to questions
                </button>
              </div>
            </div>
          ) : null}

          {phase === "result" ? (
            <ResultView
              result={widget.result}
              evaluation={evaluation}
              illustration={widget.intro?.illustration}
              onCtaClick={handleCta}
              onRestart={restart}
            >
              {widget.settings.leadCapture.mode === "after" && leadState !== "skipped" ? (
                <LeadForm
                  variant="after"
                  settings={widget.settings.leadCapture}
                  privacyNote={widget.settings.privacyNote}
                  submitting={leadState === "sending"}
                  submitted={leadState === "done"}
                  onSubmit={submitLead}
                  onSkip={skipLead}
                />
              ) : null}
            </ResultView>
          ) : null}
        </div>
      </div>

      {/* With a rail, the badge lives in its footer. Without one there's
          nowhere to put it but under the card. */}
      {badge && !widget.settings.showProgress ? (
        <div className="qw-badge-row">{badge}</div>
      ) : null}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <path
        d="M12 3l7 2.5v6c0 4.2-3 7.5-7 8.5-4-1-7-4.3-7-8.5v-6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Progress rail                                                       */
/* ------------------------------------------------------------------ */

/**
 * On wide layouts this is the sidebar from §9. On narrow ones it collapses to
 * a title, a "Step 2 of 5" and a bar — the same information, a tenth of the
 * height, which is what §36 asks for.
 */
function Rail({
  name,
  steps,
  currentId,
  phase,
  progress,
  stepNumber,
  logoUrl,
  onJump,
  isReachable,
  badge,
}: {
  name: string;
  steps: Array<{ id: string; title: string }>;
  currentId?: string;
  phase: Phase;
  progress: number;
  stepNumber: number;
  logoUrl?: string;
  onJump: (index: number) => void;
  isReachable: (index: number) => boolean;
  badge?: React.ReactNode;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentId);

  return (
    <aside className="qw-rail qw-panel">
      <div className="qw-rail-head">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mb-2 h-7 w-auto object-contain" />
        ) : null}
        <p className="text-sm font-bold leading-tight">{name}</p>
        <p className="qw-faint mt-0.5 text-xs font-medium">
          {phase === "result"
            ? "Your result"
            : steps.length > 0
              ? `Step ${Math.max(1, stepNumber)} of ${steps.length}`
              : "Getting started"}
        </p>
        <div className="qw-bar mt-3">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <ol className="qw-rail-list qw-rail-steps">
        {steps.map((step, index) => {
          const state =
            phase === "result" || index < currentIndex
              ? "done"
              : step.id === currentId
                ? "current"
                : "todo";
          return (
            <li key={step.id}>
              <button
                type="button"
                className="qw-rail-item"
                data-state={state}
                disabled={!isReachable(index)}
                onClick={() => onJump(index)}
              >
                <span className="qw-rail-dot">
                  <StepGlyph title={step.title} />
                </span>

                {/* Two lines, not an ellipsis: "How many bedrooms?" and "How
                    many bathrooms?" are indistinguishable when truncated. */}
                <span className="line-clamp-2 flex-1 text-left leading-snug">
                  <span className="qw-rail-num">{index + 1}.</span> {step.title}
                </span>

                {/* Where you are and where you've been, on the right, so the
                    left edge stays a clean column of marks. */}
                <span className="qw-rail-mark" aria-hidden="true">
                  {state === "done" ? (
                    <CheckIcon size={13} strokeWidth={3} />
                  ) : state === "current" ? (
                    <ChevronRightIcon size={14} />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {badge ? <div className="qw-rail-foot">{badge}</div> : null}
    </aside>
  );
}
