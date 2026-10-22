"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreAction } from "@/app/studio/actions";

export interface VersionRow {
  id: string;
  version: number;
  status: "succeeded" | "failed";
  source: string;
  section: string | null;
  createdAt: string;
  error: string | null;
  current: boolean;
}

const SOURCE: Record<string, string> = {
  ai: "Generated",
  mock: "Generated (offline)",
  edit: "Your edit",
  restore: "Restored",
};

export function VersionHistory({ versions }: { versions: VersionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (versions.length === 0) return null;
  return (
    <details className="no-print rounded-3xl border border-line bg-paper p-5 sm:p-7">
      <summary className="cursor-pointer font-serif text-xl text-oxblood">Version history ({versions.length})</summary>
      <p className="mt-2 text-sm text-ink-soft">Every save and regeneration is kept. Restoring copies an old version to the top.</p>
      {message ? <p role="status" className="mt-3 text-sm font-medium text-success">{message}</p> : null}
      <ol className="mt-4 divide-y divide-line">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">
                Version {v.version} · {SOURCE[v.source] ?? v.source}
                {v.section ? ` (${v.section.replace(/^prompt:/, "prompt ")})` : ""}
                {v.current ? <span className="ml-2 text-sm font-normal text-success">current</span> : null}
              </p>
              <p className="text-sm text-ink-soft">
                {new Date(v.createdAt).toLocaleString()}
                {v.status === "failed" ? ` — didn't work: ${v.error ?? "unknown error"}` : ""}
              </p>
            </div>
            {v.status === "succeeded" && !v.current ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await restoreAction(v.id);
                    setMessage(result.message ?? null);
                    router.refresh();
                  })
                }
                className="min-h-10 rounded-full border border-oxblood px-4 text-sm font-semibold text-oxblood hover:bg-blush-soft"
              >
                Restore
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
