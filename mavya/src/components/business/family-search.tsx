"use client";

import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

type Family = { name: string; guardian: string; children: { name: string; level: string }[] };

// Filters an already-loaded list; no data leaves the page.
export function FamilySearch({ families }: { families: Family[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) =>
      [f.name, f.guardian, ...f.children.map((c) => c.name)].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [families, query]);

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block max-w-md">
        <span className="sr-only">Search families</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by family, parent or child"
          className="h-12 w-full rounded-full border border-line bg-surface pr-4 pl-12 text-base placeholder:text-muted focus-visible:border-cobalt"
        />
      </label>
      <p className="text-sm text-muted" aria-live="polite">
        {shown.length} {shown.length === 1 ? "family" : "families"}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((f) => (
          <li
            key={f.name}
            className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-surface-soft [&_svg]:size-5">
                <Users aria-hidden />
              </span>
              <div>
                <p className="font-display text-lg font-semibold">{f.name} family</p>
                <p className="text-sm text-muted">{f.guardian}</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {f.children.map((c) => (
                <li
                  key={c.name}
                  className="rounded-full bg-surface-soft px-3 py-1 text-sm font-semibold"
                >
                  {c.name} <span className="font-normal text-muted">· {c.level}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
