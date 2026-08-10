"use client";

// "What do you want your website to do?" (brief §10)
//
// The most important interaction on the homepage, and the same component runs
// the New widget screen (§29) — one prompt box, two placements, so the thing a
// visitor learned on the homepage is the thing they use forever after.
//
// The progress states are the four stages the request genuinely goes through,
// shown in order while it's in flight. They never claim to have finished
// before the server says so (§41).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "@/components/ui/Icons";
import type { WidgetType } from "@/lib/widget/schema";

const STAGES = [
  "Understanding your idea…",
  "Building the questions…",
  "Creating the logic…",
  "Making it look good…",
];

const SUGGESTIONS = [
  "Cleaning quote",
  "ROI calculator",
  "Product recommender",
  "Website project estimate",
  "Event budget",
];

interface PromptBoxProps {
  variant?: "hero" | "page";
  preferredType?: WidgetType;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PromptBox({
  variant = "hero",
  preferredType,
  placeholder = "Describe the calculator, quiz or estimator you want to create…",
  autoFocus = false,
}: PromptBoxProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!busy) return;
    // Walk the stages while we wait. The last one holds until the response
    // lands, so a slow model shows "Making it look good…" rather than lying.
    const timer = setInterval(() => setStage((current) => Math.min(current + 1, STAGES.length - 1)), 900);
    return () => clearInterval(timer);
  }, [busy]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Tell us a little about what you want to build.");
      textarea.current?.focus();
      return;
    }

    setBusy(true);
    setStage(0);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, type: preferredType }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        widgetId?: string;
        error?: string;
        note?: string;
      };

      if (!data.ok || !data.widgetId) {
        setError(data.error ?? "That didn't work. Try describing it a little differently.");
        setBusy(false);
        return;
      }

      const query = data.note ? `?note=${encodeURIComponent(data.note)}` : "";
      router.push(`/dashboard/widgets/${data.widgetId}${query}`);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className={variant === "hero" ? "card p-7 sm:p-8" : "card p-8"} aria-live="polite">
        <ol className="space-y-3">
          {STAGES.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 text-sm font-medium transition ${
                index <= stage ? "text-navy" : "text-muted"
              }`}
            >
              <span
                className={`grid h-6 w-6 flex-none place-items-center rounded-full text-xs ${
                  index < stage
                    ? "bg-purple text-white"
                    : index === stage
                      ? "bg-purple-soft text-purple animate-pulseSoft"
                      : "bg-lavender text-muted"
                }`}
              >
                {index < stage ? "✓" : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className="qw-bar mt-6" style={{ ["--w-border" as string]: "#E7EAF6", ["--w-accent" as string]: "#5B5FEF" }}>
          <span style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(prompt);
        }}
        className={
          variant === "hero"
            ? "rounded-panel border border-rule bg-white p-3 shadow-lift"
            : "rounded-panel border border-rule bg-white p-3 shadow-soft"
        }
      >
        <label htmlFor="build-prompt" className="sr-only">
          Describe the widget you want to create
        </label>
        <textarea
          id="build-prompt"
          ref={textarea}
          rows={variant === "hero" ? 2 : 3}
          value={prompt}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits; Shift+Enter is a newline. Cmd/Ctrl+Enter too, for
            // people whose fingers expect it.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(prompt);
            }
          }}
          className="w-full resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-navy placeholder:text-muted focus:outline-none"
        />

        <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-1">
          <p className="hidden text-xs text-muted sm:block">
            The more you tell us — questions, prices, rules — the better it lands.
          </p>
          <button type="submit" className="btn btn-lg ml-auto">
            <SparkleIcon size={18} />
            Build it
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-2 px-1 text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="pill whitespace-nowrap"
            onClick={() => {
              setPrompt(suggestion);
              textarea.current?.focus();
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
