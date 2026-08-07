"use client";

// Select some, tap a name.
//
// A client component for one reason: selection is a state that exists before
// anything is saved, and a server round trip per tick would make ticking
// forty photographs feel like forty page loads. Everything it eventually
// submits goes through the same server action a single tap does.
//
// The counter and the name row are pinned to the bottom of the screen
// because the selection happens by scrolling. A control that scrolls away
// from the thing it controls is a control people lose, and then they have
// forty ticked photographs and no visible way to finish.

import { useState } from "react";
import type { Person } from "@/lib/memories/who";

export interface TaggableMemory {
  id: string;
  type: string;
  text: string | null;
  when: string;
  photo: string | null;
  who: string[];
}

export function TagSheet({
  subjectId,
  people,
  memories,
  action,
}: {
  subjectId: string;
  people: Person[];
  memories: TaggableMemory[];
  action: (formData: FormData) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nameOf = (key: string) => people.find((p) => p.key === key)?.name ?? null;

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="subject_id" value={subjectId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {memories.map((m) => {
          const on = picked.has(m.id);
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => toggle(m.id)}
              aria-pressed={on}
              className={`overflow-hidden rounded-md border text-left transition ${
                on ? "border-clay ring-2 ring-clay" : "border-rule hover:border-ink/40"
              }`}
            >
              <span className="block aspect-[4/5] bg-rule/40">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center p-3 text-left font-display text-sm leading-snug text-stone">
                    {m.text ?? m.type}
                  </span>
                )}
              </span>
              <span className="block px-2.5 py-2">
                <span className="block text-[0.7rem] text-stone">{m.when}</span>
                {/* Who is already on it, so a second pass does not re-tag
                    what a first pass finished. */}
                {m.who.length > 0 && (
                  <span className="mt-0.5 block truncate text-[0.7rem] text-clay">
                    {m.who.map(nameOf).filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              {picked.has(m.id) && <input type="hidden" name="memory_id" value={m.id} />}
            </button>
          );
        })}
      </div>

      {/* Pinned, because the selection is made by scrolling and a control
          that scrolls away is a control people lose. Rendered only when
          something is selected, so it is never a bar in the way of looking. */}
      {picked.size > 0 && (
        <div className="sticky bottom-4 z-10 mt-6 rounded-lg border border-clay bg-card p-4 shadow-lg">
          <p className="text-sm">
            {picked.size} selected &mdash; who&rsquo;s in {picked.size === 1 ? "it" : "them"}?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.key}
                name="who"
                value={p.key}
                className="rounded-full border border-rule px-3.5 py-1.5 text-sm transition hover:border-ink hover:bg-ink hover:text-paper"
              >
                {p.name}
                {p.relationship && (
                  <span className="ml-1.5 text-xs text-stone">{p.relationship}</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="mt-3 text-xs text-stone hover:text-ink"
          >
            Clear the selection
          </button>
        </div>
      )}
    </form>
  );
}
