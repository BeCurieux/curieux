// Small marks for the step rail.
//
// The rail wants a hint of what each question is about at 18px, which the
// full-colour illustrations can't do — they're drawn for 44px answer cards and
// turn to mush smaller than that. These are line glyphs: one stroke weight,
// no fill, `currentColor` so the rail's own done/current/todo colours apply.
//
// No new authoring burden: the glyph is inferred from the question's wording
// by the same matcher that picks illustrations, so "And bathrooms?" gets a
// bath without anyone choosing one.

import { guessIllustration, type IllustrationKey } from "@/lib/widget/illustrations";

type GlyphName =
  | "home"
  | "bed"
  | "bath"
  | "sparkle"
  | "person"
  | "people"
  | "calendar"
  | "coins"
  | "chart"
  | "camera"
  | "box"
  | "clock"
  | "question"
  | "screen"
  | "dot";

/** Many illustrations, a dozen glyphs — several pictures share a mark. */
const GLYPH_FOR: Partial<Record<IllustrationKey, GlyphName>> = {
  house: "home",
  window: "home",
  bed: "bed",
  bath: "bath",
  droplet: "bath",
  couch: "home",
  sparkle: "sparkle",
  star: "sparkle",
  heart: "sparkle",
  gift: "sparkle",
  plant: "sparkle",
  sun: "sparkle",
  shield: "sparkle",
  balloons: "sparkle",
  cake: "sparkle",
  person: "person",
  people: "people",
  calendar: "calendar",
  coins: "coins",
  wallet: "coins",
  graph: "chart",
  chart: "chart",
  target: "chart",
  camera: "camera",
  music: "camera",
  box: "box",
  truck: "box",
  oven: "box",
  bucket: "box",
  sponge: "box",
  clock: "clock",
  question: "question",
  browser: "screen",
  cursor: "screen",
  phone: "screen",
  palette: "screen",
  rocket: "screen",
};

const PATHS: Record<GlyphName, React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z" />,
  bed: <path d="M3 18v-7m0 4h18m0 3v-6a2 2 0 0 0-2-2h-8v5M7 9.5h1.5" />,
  bath: <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3ZM7 12V6a2 2 0 0 1 4 0M6 19l-1 2M18 19l1 2" />,
  sparkle: <path d="M12 4c.9 4.2 2.4 5.6 6.5 6.5C14.4 11.4 13 12.8 12 17c-.9-4.2-2.4-5.6-6.5-6.5C9.6 9.6 11 8.2 12 4ZM18 16.5c.3 1.4.8 1.9 2.2 2.2-1.4.3-1.9.8-2.2 2.2-.3-1.4-.8-1.9-2.2-2.2 1.4-.3 1.9-.8 2.2-2.2Z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20c0-3 2.7-4.9 6-4.9s6 1.9 6 4.9M16 6.6a3 3 0 0 1 0 5.8M17 14.6c2.4.4 4 2.2 4 4.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  coins: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M10 10.2h3.2M10 13.8h3.2" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8 16v-4M12.5 16V8M17 16v-6" />,
  camera: (
    <>
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.5-2h6l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  box: <path d="M12 3.5 20.5 8v8L12 20.5 3.5 16V8L12 3.5ZM3.5 8 12 12.5 20.5 8M12 12.5v8" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7v5.3l3.4 2" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.6 9.6a2.5 2.5 0 0 1 4.7-.9c.6 1.4-.6 2.2-1.5 2.9-.7.5-.9 1-.9 1.6" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  screen: (
    <>
      <rect x="3.5" y="4.5" width="17" height="13" rx="2.5" />
      <path d="M3.5 8.5h17M9 21h6" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" />,
};

export function StepGlyph({ title, size = 18 }: { title: string; size?: number }) {
  const key = guessIllustration(title);
  const glyph = (key && GLYPH_FOR[key]) ?? "dot";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="qw-rail-glyph"
    >
      {PATHS[glyph]}
    </svg>
  );
}
