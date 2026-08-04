"use client";

// "Why is this here?" (brief §14): show the provenance of AI-drafted copy.
import { useState } from "react";

export function WhyIsThisHere({ sources }: { sources: { kind: string; id: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-clay underline decoration-dotted"
      >
        Why is this here?
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-10 block w-64 rounded-lg border border-sand bg-white p-3 text-xs shadow-lg">
          This line is supported by:
          <ul className="mt-1 list-disc pl-4">
            {sources.map((s, i) => (
              <li key={i}>
                {s.kind === "memory" && "a memory you added"}
                {s.kind === "answer" && "your answer to a question"}
                {s.kind === "little_thing" && "a little thing you recorded"}
                <span className="text-ink/40"> ({s.id.slice(0, 8)})</span>
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
