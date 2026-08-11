"use client";

// Adding one thing, quickly.
//
// The upload page is built for the afternoon someone empties a year of
// camera roll into the archive. This is for the other 360 days: standing in
// a kitchen, phone in one hand, wanting to write down what was just said
// before it goes.
//
// Four kinds on one row, one field, one button. No date picker — today is
// almost always right and the date can be corrected later from the years
// view. Every additional decision here is a reason not to bother, and the
// whole always-on thesis rests on people bothering.

import { useRef, useState } from "react";
import { PRIVATE_BLURB } from "@/lib/family/roles";

type Kind = "photo" | "note" | "saying" | "voice";

const KINDS: { kind: Kind; label: string; placeholder: string }[] = [
  { kind: "photo", label: "photo", placeholder: "What's happening here? (optional)" },
  { kind: "note", label: "note", placeholder: "A moment you don't want to lose. A sentence is plenty." },
  { kind: "saying", label: "saying", placeholder: "Word for word, mistakes and all." },
  { kind: "voice", label: "voice", placeholder: "What are they talking about? (optional)" },
];

export function QuickAdd({
  subjectId,
  onAdded,
}: {
  subjectId: string;
  onAdded?: () => void;
}) {
  const [kind, setKind] = useState<Kind>("saying");
  const [text, setText] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const active = KINDS.find((k) => k.kind === kind)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && kind !== "photo" && kind !== "voice") return;
    setSaving(true);
    setError(null);

    const body = new FormData();
    body.set("subject_id", subjectId);
    // A saying is a quote — the child's own words — and everything else is a
    // note. The distinction matters because quotes get their own page.
    body.set("type", kind === "saying" ? "quote" : "text");
    body.set("text", text.trim());
    if (isPrivate) body.set("private", "on");

    try {
      const res = await fetch("/api/memories/quick", { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      setText("");
      setPrivate(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onAdded?.();
    } catch {
      setError("That didn't save. Try again — nothing was lost.");
    } finally {
      setSaving(false);
    }
  }

  // Photo and voice need the real uploader and recorder, which handle bytes
  // and permissions. Rather than half-implement them here, this points at
  // them — an honest handoff beats a button that quietly does less.
  const needsUploader = kind === "photo" || kind === "voice";

  return (
    <div className="card">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => {
              setKind(k.kind);
              setTimeout(() => fieldRef.current?.focus(), 0);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              kind === k.kind
                ? "border-clay bg-clay text-white"
                : "border-rule bg-white hover:border-ink"
            }`}
            aria-pressed={kind === k.kind}
          >
            {k.label}
          </button>
        ))}
      </div>

      {needsUploader ? (
        <p className="mt-4 text-sm leading-relaxed text-stone">
          {kind === "photo"
            ? "Photographs go in below — drag in as many as you like."
            : "Recording needs the microphone; it's below."}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <textarea
            ref={fieldRef}
            className="input h-24"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={active.placeholder}
          />

          <label className="flex gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={isPrivate}
              onChange={(e) => setPrivate(e.target.checked)}
            />
            <span>
              Keep this to myself
              <span className="mt-0.5 block text-xs leading-relaxed text-stone">
                {PRIVATE_BLURB}
              </span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button className="btn" disabled={saving || !text.trim()}>
              {saving ? "Keeping…" : "Keep it"}
            </button>
            {saved && <span className="text-sm text-stone">Kept.</span>}
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
          <p className="text-xs text-stone">
            Dated today. You can change the date later from their years.
          </p>
        </form>
      )}
    </div>
  );
}
