"use client";

// Where you are, and where else you can go.
//
// Fifteen screens live under a child — years, upload, inbox, review,
// questions, film, who, little things, noticed, so far, found, clusters,
// tag, about — and until now the only way to reach any of them was a small
// ochre text link buried somewhere in a five-hundred-line scrolling page.
// You could not tell, standing on one of them, that the others existed.
//
// This is the least decorative fix available: name the places, keep them in
// the same spot on every screen, and mark the one you are on. Interface, so
// it stays in the sans — the serif is for the family's own words.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubjectNav({
  subjectId,
  waiting,
}: {
  subjectId: string;
  /** Contributions needing a decision. Zero hides the count entirely. */
  waiting: number;
}) {
  const pathname = usePathname();
  const base = `/subjects/${subjectId}`;

  const tabs: { href: string; label: string; count?: number }[] = [
    { href: base, label: "This year" },
    { href: `${base}/upload`, label: "Add" },
    { href: `${base}/years`, label: "Years" },
    { href: `${base}/who`, label: "Who’s in it" },
    { href: `${base}/questions`, label: "Questions" },
    { href: `${base}/review`, label: "Waiting on you", count: waiting },
  ];

  return (
    <nav
      aria-label="This archive"
      // Scrolls rather than wraps on a phone: a nav that reflows to three
      // lines pushes the page's own heading below the fold. The negative
      // margin pulls the rule out to the reading column's own padding, so it
      // spans the page rather than stopping short of both edges.
      className="mt-3 -mx-6 overflow-x-auto border-b border-rule px-6"
    >
      <ul className="flex min-w-max items-stretch gap-1">
        {tabs.map((tab) => {
          // Exact match for the overview, prefix for the rest — otherwise
          // "This year" stays lit on every screen underneath it.
          const active =
            tab.href === base ? pathname === base : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm transition ${
                  active
                    ? "border-clay text-clay"
                    : "border-transparent text-stone hover:border-rule hover:text-ink"
                }`}
              >
                {tab.label}
                {tab.count ? (
                  <span
                    // A number, not a red dot. The dot says "something is
                    // wrong"; this is somebody's grandmother having written
                    // something down.
                    className="rounded-full bg-clay px-1.5 py-0.5 text-[0.6875rem] leading-none text-white"
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
