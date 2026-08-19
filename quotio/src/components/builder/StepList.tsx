"use client";

// The left sidebar (brief §14).
//
//     INTRO
//     1 Home type
//     2 Bedrooms
//     …
//     RESULT
//     + Add step
//
// Reordering works two ways on purpose: drag for a mouse, and the up/down
// buttons that appear on focus or hover for everyone else. A drag-only list is
// unusable with a keyboard, and this is a list people will reorder constantly
// (§37).

import { useState } from "react";
import { DragIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import type { Selection } from "./types";
import type { WidgetDocument } from "@/lib/widget/schema";

interface StepListProps {
  doc: WidgetDocument;
  selection: Selection;
  select: (selection: Selection) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
  onDelete: (stepId: string) => void;
}

export function StepList({ doc, selection, select, onReorder, onAdd, onDelete }: StepListProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const isSelected = (candidate: Selection) =>
    candidate.kind === selection.kind &&
    (candidate.kind !== "step" || selection.kind !== "step" || candidate.id === selection.id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <RailButton
          label="Intro"
          meta={doc.intro ? "Welcome screen" : "Off"}
          selected={isSelected({ kind: "intro" })}
          onClick={() => select({ kind: "intro" })}
        />

        <p className="eyebrow mb-1 mt-4 px-2">Questions</p>

        <ul className="space-y-1">
          {doc.steps.map((step, index) => {
            const selected = selection.kind === "step" && selection.id === step.id;
            return (
              <li
                key={step.id}
                draggable
                onDragStart={() => setDragging(index)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging !== null && dragging !== index) onReorder(dragging, index);
                  setDragging(null);
                  setOver(null);
                }}
                className={`group relative rounded-btn transition ${
                  over === index && dragging !== null && dragging !== index
                    ? "ring-2 ring-purple ring-offset-1"
                    : ""
                } ${dragging === index ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => select({ kind: "step", id: step.id })}
                  className={`flex w-full items-start gap-2 rounded-btn px-2 py-2 text-left text-sm transition ${
                    selected ? "bg-purple-soft font-semibold text-purple" : "text-slate hover:bg-lavender"
                  }`}
                >
                  <DragIcon
                    size={14}
                    className="mt-[3px] flex-none cursor-grab text-muted opacity-0 transition group-hover:opacity-100"
                  />
                  <span className="w-4 flex-none text-xs font-bold leading-5 text-muted">
                    {index + 1}
                  </span>
                  {/* Two lines, not an ellipsis: a rail full of "What are we
                      buil…" tells you nothing, and questions are phrases. */}
                  <span className="line-clamp-2 leading-5">
                    {step.title || "Untitled question"}
                  </span>
                  {step.hidden ? (
                    <span className="ml-auto mt-0.5 flex-none rounded-full bg-lavender px-1.5 py-0.5 text-[10px] font-bold uppercase leading-4 text-muted">
                      Rule
                    </span>
                  ) : null}
                </button>

                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-full bg-white/95 px-1 shadow-soft group-hover:flex group-focus-within:flex">
                  <MoveButton
                    label={`Move ${step.title} up`}
                    disabled={index === 0}
                    onClick={() => onReorder(index, index - 1)}
                  >
                    ↑
                  </MoveButton>
                  <MoveButton
                    label={`Move ${step.title} down`}
                    disabled={index === doc.steps.length - 1}
                    onClick={() => onReorder(index, index + 1)}
                  >
                    ↓
                  </MoveButton>
                  <MoveButton
                    label={`Delete ${step.title}`}
                    disabled={doc.steps.length <= 1}
                    onClick={() => onDelete(step.id)}
                  >
                    <TrashIcon size={13} />
                  </MoveButton>
                </div>
              </li>
            );
          })}
        </ul>

        <button type="button" className="btn-ghost mt-1 w-full justify-start px-2" onClick={onAdd}>
          <PlusIcon size={16} />
          Add question
        </button>

        <p className="eyebrow mb-1 mt-4 px-2">Ending</p>
        <RailButton
          label="Result"
          meta={resultMeta(doc)}
          selected={isSelected({ kind: "result" })}
          onClick={() => select({ kind: "result" })}
        />
      </div>
    </div>
  );
}

function resultMeta(doc: WidgetDocument): string {
  switch (doc.result.kind) {
    case "range":
      return "A price range";
    case "recommendation":
      return `${doc.result.outcomes.length} outcomes`;
    case "score":
      return "Score & outcome";
    default:
      return "A single number";
  }
}

function RailButton({
  label,
  meta,
  selected,
  onClick,
}: {
  label: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-btn px-3 py-2.5 text-left transition ${
        selected ? "bg-purple-soft text-purple" : "text-slate hover:bg-lavender"
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-xs text-muted">{meta}</span>
    </button>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-full text-xs text-slate transition hover:bg-lavender hover:text-navy disabled:opacity-30"
    >
      {children}
    </button>
  );
}
