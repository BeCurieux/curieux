// What a visitor sees when the owner has used up the month's interactions.
//
// Two rules shaped this. It doesn't blame the visitor, and it doesn't leak the
// owner's business — no plan name, no usage numbers, nothing a competitor
// could read off a public URL. And it says when it comes back, because "try
// again later" with no "later" is the same as "never".

import { brand } from "@/config/brand";

/** First of next month, in the reader's own words. */
function returnsOn(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function PausedNotice({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-md rounded-card border border-rule bg-white p-8 text-center">
      <p className="text-sm font-bold text-navy">{name} is taking a short break</p>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        It&rsquo;s had more visitors this month than it can handle. It comes back on{" "}
        {returnsOn()}.
      </p>
      <p className="mt-4 text-xs text-muted">{brand.name}</p>
    </div>
  );
}
