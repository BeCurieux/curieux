// The MEKMI wordmark.
//
// Drawn as paths, not set in a webfont. Two reasons, and neither is
// aesthetic: a logo that reflows when a font finishes loading isn't a logo,
// and the dot on the i has to be a real component we can swap — which it
// can't be if it's a glyph inside a text node.
//
// Construction: one stroke weight, round caps and joins, letters built on a
// shared grid so the two m shapes are literally the same curve repeated. That
// is the "snapped into place" quality the brand asks for — the modularity is
// in how it's built, not decoration applied afterwards.
//
//   grid   x-height 40 → 90, ascender 14, baseline 90
//   stroke 20, round
//
// Flat colour only. No gradients, no shadow, no rendered depth.

export type DotShape = "dot" | "plus" | "question" | "toggle" | "check";

/**
 * The final character is the flexible part of the identity: a calculator gets
 * a plus, a quiz a question mark, an estimator a slider knob. `mekmi` with a
 * plain dot is the official mark; the rest are the same wordmark wearing the
 * tool it made.
 */
const DOT_LABEL: Record<DotShape, string> = {
  dot: "",
  plus: " (calculator)",
  question: " (quiz)",
  toggle: " (estimator)",
  check: " (poll)",
};

const STROKE = 20;

/** Letter paths, each in its own space, positioned by the `x` offsets below. */
const M_ARCHES = "M10 90V58q0-18 22-18t22 18v32M54 58q0-18 22-18t22 18v32";
const E =
  "M72 79q-8 13-27 13Q20 92 20 66t25-26q25 0 25 26H20";
const K = "M10 14v76M58 40 20 68M32 60l30 30";
const I_STEM = "M10 40v50";

/** Left edge of each glyph's ink, tuned by eye rather than by metric. */
const LAYOUT = { m1: 0, e: 112, k: 196, m2: 268, i: 380, dot: 390 };

export function Wordmark({
  height = 32,
  dot = "dot",
  className,
  title,
}: {
  height?: number;
  dot?: DotShape;
  className?: string;
  title?: string;
}) {
  // 404 wide × 104 tall of ink, with the dot's cap reaching y=3.
  const width = Math.round((height * 414) / 104);

  return (
    <svg
      width={width}
      height={height}
      viewBox="-10 -7 414 111"
      fill="none"
      role="img"
      aria-label={title ?? `MEKMI${DOT_LABEL[dot]}`}
      className={className}
    >
      <g
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={M_ARCHES} transform={`translate(${LAYOUT.m1} 0)`} />
        <path d={E} transform={`translate(${LAYOUT.e} 0)`} />
        <path d={K} transform={`translate(${LAYOUT.k} 0)`} />
        <path d={M_ARCHES} transform={`translate(${LAYOUT.m2} 0)`} />
        <path d={I_STEM} transform={`translate(${LAYOUT.i} 0)`} />
      </g>

      <g transform={`translate(${LAYOUT.dot} 0)`}>
        <Dot shape={dot} />
      </g>
    </svg>
  );
}

/**
 * The dot, centred on (0, 14) so every shape swaps in without nudging the
 * wordmark. Violet by default — it is the one place colour appears in the
 * logo, which is what makes it read as the movable part.
 */
function Dot({ shape, colour = "#7657F6" }: { shape: DotShape; colour?: string }) {
  // Every shape lives inside the plain dot's own footprint — x -16..16,
  // y 1..27 — so swapping one in never nudges the wordmark and never grows
  // into the i's stem, whose cap reaches y=30.
  const line = {
    stroke: colour,
    strokeWidth: 13,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  switch (shape) {
    case "plus":
      return <path d="M0 5v18M-9 14h18" {...line} />;
    case "question":
      return (
        <g>
          <path d="M-8 8a8 8 0 0 1 15 2c0 4-6 5-6 9" {...line} strokeWidth={11} />
          <circle cx="1" cy="25" r="6" fill={colour} />
        </g>
      );
    case "toggle":
      return (
        <g>
          <rect x="-16" y="3" width="32" height="22" rx="11" fill={colour} />
          <circle cx="6" cy="14" r="7" fill="#FFF9F1" />
        </g>
      );
    case "check":
      return <path d="M-10 14-3 21 11 5" {...line} />;
    case "dot":
    default:
      return <circle cx="0" cy="14" r="13" fill={colour} />;
  }
}

/**
 * The square mark: the lowercase m alone, in a navy tile with the violet dot.
 * Derived from the wordmark's own letterform rather than drawn separately, so
 * the favicon and the logo can't drift apart.
 */
export function MekmiMark({ size = 32, className }: { size?: number; className?: string }) {
  // The m's ink runs x -10..118, y 30..100 in wordmark space. Scaled to 84
  // wide and set low-left, with the dot on its right shoulder — the same
  // relationship the wordmark has, so the two can't drift apart. Sized for
  // 16px: at favicon scale the tile and the dot are what carry it.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="MEKMI"
      className={className}
    >
      <rect width="120" height="120" rx="30" fill="#18233A" />
      <g
        transform="translate(21.6 30.3) scale(0.656)"
        stroke="#FFF9F1"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={M_ARCHES} />
      </g>
      <circle cx="97" cy="30" r="14" fill="#7657F6" />
    </svg>
  );
}
