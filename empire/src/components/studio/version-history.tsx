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
    <details className="no-print border-line bg-paper rounded-3xl border p-5 sm:p-7">
      <summary className="text-oxblood cursor-pointer font-serif text-xl">
        Version history ({versions.length})
      </summary>
      <p className="text-ink-soft mt-2 text-sm">
        Every save and regeneration is kept. Restoring copies an old version to the top.
      </p>
      {message ? (
        <p role="status" className="text-success mt-3 text-sm font-medium">
          {message}
        </p>
      ) : null}
      <ol className="divide-line mt-4 divide-y">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">
                Version {v.version} · {SOURCE[v.source] ?? v.source}
                {v.section ? ` (${v.section.replace(/^prompt:/, "prompt ")})` : ""}
                {v.current ? (
                  <span className="text-success ml-2 text-sm font-normal">current</span>
                ) : null}
              </p>
              <p className="text-ink-soft text-sm">
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
                className="border-oxblood text-oxblood hover:bg-blush-soft min-h-10 rounded-full border px-4 text-sm font-semibold"
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
