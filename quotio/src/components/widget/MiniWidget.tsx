// A scale model of a widget.
//
// Used on the template gallery and on the dashboard, so a widget is
// recognisable at a glance in both places. Built from the document itself —
// its real first question, its real first answers — rather than from
// hand-written mock data, so a miniature can't advertise something the widget
// doesn't actually ask.
//
// Decorative in both callers (`aria-hidden`): the widget's name always sits
// beside it in real text.

import { Illustration } from "@/components/illustrations/Illustration";
import type { IllustrationKey } from "@/lib/widget/illustrations";
import type { WidgetDocument } from "@/lib/widget/schema";

export interface MiniWidgetData {
  brandColour: string;
  question: string;
  options: Array<{ id: string; label: string; illustration?: IllustrationKey }>;
}

/** Pull the miniature out of a widget document. */
export function miniFromDocument(document: WidgetDocument): MiniWidgetData {
  // Prefer a question with answer cards to show; fall back to the first.
  const step =
    document.steps.find((entry) => entry.input.kind === "choice") ?? document.steps[0];

  return {
    brandColour: document.theme.brandColour,
    question: step?.title ?? document.name,
    options:
      step?.input.kind === "choice"
        ? step.input.options.slice(0, 3).map((option) => ({
            id: option.id,
            label: option.label,
            illustration: option.illustration,
          }))
        : [],
  };
}

export function MiniWidget({ data }: { data: MiniWidgetData }) {
  const { brandColour, question, options } = data;

  return (
    <div
      className="rounded-[10px] border border-white/70 bg-white p-2.5 shadow-soft"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-1 w-6 rounded-full" style={{ background: brandColour }} />
        <span className="h-1 flex-1 rounded-full bg-rule" />
      </div>

      <p className="mt-2 truncate text-[10px] font-bold leading-tight text-navy">{question}</p>

      {options.length > 0 ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {options.map((option, index) => (
            <span
              key={option.id}
              className="flex h-[46px] flex-col items-center justify-center gap-0.5 rounded-[7px] border px-0.5"
              style={
                index === 0
                  ? { borderColor: brandColour, background: `${brandColour}14` }
                  : { borderColor: "#E7EAF6", background: "#FFFFFF" }
              }
            >
              <span className="w-full truncate text-center text-[8px] font-bold leading-none text-navy">
                {option.label}
              </span>
              {option.illustration ? (
                <Illustration name={option.illustration} size={22} />
              ) : (
                <span className="h-[22px]" />
              )}
            </span>
          ))}
        </div>
      ) : (
        // Sliders and number fields have no answer cards to show.
        <div className="mt-1.5 flex h-[46px] flex-col justify-center gap-1.5 rounded-[7px] border border-rule px-2">
          <span className="h-1.5 rounded-full bg-rule">
            <span className="block h-1.5 w-2/5 rounded-full" style={{ background: brandColour }} />
          </span>
          <span className="h-1 w-8 rounded-full bg-rule" />
        </div>
      )}
    </div>
  );
}

/** The tinted band the miniature sits in, shared by both callers. */
export function MiniWidgetFrame({
  brandColour,
  badge,
  children,
}: {
  brandColour: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative border-b border-rule px-3.5 pb-3.5 pt-9"
      style={{ background: `${brandColour}1F` }}
    >
      {badge}
      {children}
    </div>
  );
}
