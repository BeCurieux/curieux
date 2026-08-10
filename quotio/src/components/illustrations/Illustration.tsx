// The illustration system (brief §8).
//
// Flat, rounded, friendly, few details, brand palette only. Every drawing
// lives on a 48×48 grid so a row of answer cards has optically matched
// artwork without anyone hand-tuning sizes.
//
// These are decorative: each one is `aria-hidden`, and the thing it sits
// beside always carries the real label. An illustration never carries meaning
// on its own (§37).

import type { IllustrationKey } from "@/lib/widget/illustrations";

const C = {
  purple: "#5B5FEF",
  purpleSoft: "#DDDEFC",
  mint: "#7DD3C7",
  mintSoft: "#DCF3EF",
  yellow: "#FFC857",
  yellowSoft: "#FFEFCF",
  coral: "#FF8FA3",
  coralSoft: "#FFE0E6",
  navy: "#1B1F3B",
  white: "#FFFFFF",
} as const;

export interface IllustrationProps {
  name: IllustrationKey;
  size?: number;
  className?: string;
}

export function Illustration({ name, size = 44, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      shapeRendering="geometricPrecision"
    >
      {DRAWINGS[name]}
    </svg>
  );
}

/** Rounded-corner helper keeps the shape language consistent (§7). */
const r = 4;

const DRAWINGS: Record<IllustrationKey, JSX.Element> = {
  bed: (
    <g>
      <rect x="5" y="17" width="38" height="16" rx={r} fill={C.purpleSoft} />
      <rect x="5" y="26" width="38" height="7" rx="3" fill={C.purple} />
      <rect x="9" y="20" width="12" height="6" rx="3" fill={C.white} />
      <rect x="5" y="31" width="4" height="9" rx="2" fill={C.navy} />
      <rect x="39" y="31" width="4" height="9" rx="2" fill={C.navy} />
      <path d="M5 21c0-6 4-10 10-10h18c6 0 10 4 10 10" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  bath: (
    <g>
      <path d="M6 25h36v5a9 9 0 0 1-9 9H15a9 9 0 0 1-9-9v-5Z" fill={C.mintSoft} />
      <rect x="4" y="22" width="40" height="4" rx="2" fill={C.mint} />
      <path d="M14 22v-9a4 4 0 0 1 8 0" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="16" r="3" fill={C.purple} />
      <rect x="12" y="39" width="3" height="5" rx="1.5" fill={C.navy} />
      <rect x="33" y="39" width="3" height="5" rx="1.5" fill={C.navy} />
    </g>
  ),
  couch: (
    <g>
      <rect x="6" y="20" width="36" height="14" rx={r} fill={C.coralSoft} />
      <rect x="4" y="24" width="6" height="12" rx="3" fill={C.coral} />
      <rect x="38" y="24" width="6" height="12" rx="3" fill={C.coral} />
      <rect x="10" y="28" width="28" height="8" rx="3" fill={C.coral} />
      <rect x="13" y="21" width="9" height="8" rx="3" fill={C.white} />
      <rect x="26" y="21" width="9" height="8" rx="3" fill={C.white} />
      <rect x="10" y="36" width="3" height="5" rx="1.5" fill={C.navy} />
      <rect x="35" y="36" width="3" height="5" rx="1.5" fill={C.navy} />
    </g>
  ),
  bucket: (
    <g>
      <path d="M11 18h26l-3 20a4 4 0 0 1-4 3H18a4 4 0 0 1-4-3L11 18Z" fill={C.mint} />
      <rect x="9" y="14" width="30" height="6" rx="3" fill={C.navy} />
      <path d="M15 14a9 9 0 0 1 18 0" stroke={C.navy} strokeWidth="2.5" fill="none" />
      <circle cx="21" cy="28" r="2.5" fill={C.white} />
      <circle cx="28" cy="33" r="2" fill={C.white} />
    </g>
  ),
  sponge: (
    <g>
      <rect x="7" y="16" width="34" height="18" rx="6" fill={C.yellow} />
      <rect x="7" y="16" width="34" height="7" rx="3.5" fill={C.mint} />
      <circle cx="16" cy="29" r="2" fill={C.white} />
      <circle cx="24" cy="27" r="1.5" fill={C.white} />
      <circle cx="32" cy="30" r="2" fill={C.white} />
      <path d="M12 38c4-2 8-2 12 0s8 2 12 0" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  oven: (
    <g>
      <rect x="8" y="8" width="32" height="34" rx={r} fill={C.purpleSoft} />
      <rect x="12" y="20" width="24" height="18" rx="3" fill={C.navy} />
      <rect x="15" y="23" width="18" height="12" rx="2" fill={C.yellow} />
      <circle cx="15" cy="14" r="2.5" fill={C.purple} />
      <circle cx="24" cy="14" r="2.5" fill={C.purple} />
      <circle cx="33" cy="14" r="2.5" fill={C.coral} />
    </g>
  ),
  window: (
    <g>
      <rect x="8" y="7" width="32" height="34" rx={r} fill={C.mintSoft} />
      <rect x="8" y="7" width="32" height="34" rx={r} stroke={C.navy} strokeWidth="2.5" />
      <path d="M24 7v34M8 24h32" stroke={C.navy} strokeWidth="2.5" />
      <path d="M12 18l6-6" stroke={C.white} strokeWidth="3" strokeLinecap="round" />
      <circle cx="34" cy="14" r="3" fill={C.yellow} />
    </g>
  ),
  house: (
    <g>
      <path d="M24 6 42 20v18a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V20L24 6Z" fill={C.purpleSoft} />
      <path d="M4 21 24 6l20 15" stroke={C.purple} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="19" y="27" width="10" height="15" rx="2" fill={C.purple} />
      <rect x="11" y="24" width="6" height="6" rx="2" fill={C.yellow} />
      <rect x="31" y="24" width="6" height="6" rx="2" fill={C.yellow} />
    </g>
  ),
  coins: (
    <g>
      <ellipse cx="24" cy="34" rx="15" ry="6" fill={C.yellow} />
      <rect x="9" y="26" width="30" height="8" fill={C.yellow} />
      <ellipse cx="24" cy="26" rx="15" ry="6" fill={C.yellowSoft} />
      <ellipse cx="24" cy="16" rx="12" ry="5" fill={C.yellow} />
      <ellipse cx="24" cy="15" rx="12" ry="5" fill={C.yellowSoft} />
      <path d="M24 11v8M22 14h4" stroke={C.navy} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  wallet: (
    <g>
      <rect x="6" y="13" width="36" height="24" rx={r} fill={C.purple} />
      <rect x="6" y="13" width="36" height="8" rx={r} fill={C.purpleSoft} />
      <rect x="28" y="22" width="16" height="10" rx="3" fill={C.navy} />
      <circle cx="34" cy="27" r="2.5" fill={C.yellow} />
    </g>
  ),
  graph: (
    <g>
      <rect x="6" y="8" width="36" height="32" rx={r} fill={C.mintSoft} />
      <path d="M12 32l8-8 6 5 10-12" stroke={C.mint} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="36" cy="17" r="3.5" fill={C.purple} />
    </g>
  ),
  chart: (
    <g>
      <rect x="6" y="8" width="36" height="32" rx={r} fill={C.purpleSoft} />
      <rect x="12" y="24" width="6" height="10" rx="2" fill={C.purple} />
      <rect x="21" y="18" width="6" height="16" rx="2" fill={C.mint} />
      <rect x="30" y="13" width="6" height="21" rx="2" fill={C.yellow} />
    </g>
  ),
  target: (
    <g>
      <circle cx="24" cy="24" r="17" fill={C.coralSoft} />
      <circle cx="24" cy="24" r="11" fill={C.white} />
      <circle cx="24" cy="24" r="11" stroke={C.coral} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="4.5" fill={C.coral} />
      <path d="M24 24 40 8" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  balloons: (
    <g>
      <ellipse cx="17" cy="18" rx="9" ry="11" fill={C.coral} />
      <ellipse cx="31" cy="21" rx="8" ry="10" fill={C.purple} />
      <path d="M17 29c1 6-3 8-2 13M31 31c-1 5 2 7 1 11" stroke={C.navy} strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="14" cy="14" rx="2.5" ry="3.5" fill={C.white} opacity="0.7" />
    </g>
  ),
  cake: (
    <g>
      <rect x="8" y="24" width="32" height="16" rx={r} fill={C.coralSoft} />
      <rect x="8" y="24" width="32" height="7" rx="3" fill={C.coral} />
      <rect x="22" y="12" width="4" height="9" rx="2" fill={C.mint} />
      <ellipse cx="24" cy="10" rx="2.5" ry="3.5" fill={C.yellow} />
      <circle cx="15" cy="35" r="2" fill={C.purple} />
      <circle cx="24" cy="36" r="2" fill={C.mint} />
      <circle cx="33" cy="35" r="2" fill={C.yellow} />
    </g>
  ),
  calendar: (
    <g>
      <rect x="7" y="11" width="34" height="30" rx={r} fill={C.white} stroke={C.navy} strokeWidth="2.5" />
      <rect x="7" y="11" width="34" height="9" rx={r} fill={C.purple} />
      <rect x="14" y="6" width="3.5" height="9" rx="1.75" fill={C.navy} />
      <rect x="30" y="6" width="3.5" height="9" rx="1.75" fill={C.navy} />
      <rect x="13" y="25" width="7" height="6" rx="2" fill={C.yellow} />
      <rect x="24" y="25" width="7" height="6" rx="2" fill={C.mintSoft} />
      <rect x="13" y="34" width="7" height="4" rx="2" fill={C.mintSoft} />
      <rect x="24" y="34" width="7" height="4" rx="2" fill={C.mintSoft} />
    </g>
  ),
  camera: (
    <g>
      <rect x="5" y="15" width="38" height="24" rx={r} fill={C.purple} />
      <rect x="17" y="9" width="14" height="8" rx="3" fill={C.purpleSoft} />
      <circle cx="24" cy="27" r="9" fill={C.white} />
      <circle cx="24" cy="27" r="5" fill={C.mint} />
      <circle cx="37" cy="21" r="2" fill={C.yellow} />
    </g>
  ),
  music: (
    <g>
      <path d="M20 34V12l16-4v22" stroke={C.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="15" cy="34" rx="6" ry="5" fill={C.purple} />
      <ellipse cx="31" cy="30" rx="6" ry="5" fill={C.mint} />
    </g>
  ),
  browser: (
    <g>
      <rect x="5" y="9" width="38" height="30" rx={r} fill={C.white} stroke={C.navy} strokeWidth="2.5" />
      <path d="M5 18h38" stroke={C.navy} strokeWidth="2.5" />
      <circle cx="11" cy="13.5" r="1.8" fill={C.coral} />
      <circle cx="17" cy="13.5" r="1.8" fill={C.yellow} />
      <circle cx="23" cy="13.5" r="1.8" fill={C.mint} />
      <rect x="10" y="23" width="14" height="4" rx="2" fill={C.purpleSoft} />
      <rect x="10" y="30" width="22" height="4" rx="2" fill={C.purpleSoft} />
    </g>
  ),
  cursor: (
    <g>
      <path d="M15 8l20 15-9 2 5 11-5 2-5-11-6 6V8Z" fill={C.purple} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M36 10l4-4M40 18h5M31 5l1-4" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  phone: (
    <g>
      <rect x="13" y="5" width="22" height="38" rx="6" fill={C.navy} />
      <rect x="16" y="10" width="16" height="26" rx="3" fill={C.mintSoft} />
      <rect x="20" y="7" width="8" height="2" rx="1" fill={C.white} opacity="0.6" />
      <circle cx="24" cy="39" r="2" fill={C.white} opacity="0.6" />
      <rect x="19" y="15" width="10" height="3" rx="1.5" fill={C.purple} />
      <rect x="19" y="21" width="7" height="3" rx="1.5" fill={C.mint} />
    </g>
  ),
  palette: (
    <g>
      <path d="M24 7c10 0 18 7 18 16 0 6-5 8-9 8h-3c-3 0-4 2-4 4s-1 6-5 6C13 41 6 33 6 23 6 14 14 7 24 7Z" fill={C.yellowSoft} stroke={C.navy} strokeWidth="2.5" />
      <circle cx="16" cy="19" r="3" fill={C.coral} />
      <circle cx="25" cy="15" r="3" fill={C.purple} />
      <circle cx="33" cy="20" r="3" fill={C.mint} />
      <circle cx="15" cy="29" r="3" fill={C.yellow} />
    </g>
  ),
  rocket: (
    <g>
      <path d="M24 5c7 6 10 14 10 22l-5 5H19l-5-5c0-8 3-16 10-22Z" fill={C.purpleSoft} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="19" r="4" fill={C.purple} />
      <path d="M19 32l-3 8 8-4 8 4-3-8" fill={C.coral} />
      <path d="M14 25l-5 6 5-1M34 25l5 6-5-1" fill={C.mint} />
    </g>
  ),
  person: (
    <g>
      <circle cx="24" cy="16" r="8" fill={C.purple} />
      <path d="M9 41c0-8 7-13 15-13s15 5 15 13" fill={C.purpleSoft} />
    </g>
  ),
  people: (
    <g>
      <circle cx="16" cy="17" r="7" fill={C.mint} />
      <circle cx="33" cy="19" r="6" fill={C.purple} />
      <path d="M3 40c0-7 6-11 13-11s13 4 13 11" fill={C.mintSoft} />
      <path d="M25 40c0-6 4-9 9-9s11 3 11 9" fill={C.purpleSoft} />
    </g>
  ),
  question: (
    <g>
      <circle cx="24" cy="24" r="18" fill={C.yellowSoft} />
      <path
        d="M18 19a6 6 0 0 1 11-3c1.5 3-1 5-3 6.5-1.6 1.2-2 2-2 3.5"
        stroke={C.navy}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="24" cy="33" r="2.5" fill={C.navy} />
    </g>
  ),
  star: (
    <g>
      <path
        d="m24 6 5.2 10.9 11.8 1.6-8.6 8.4 2.1 11.9L24 33.1 13.5 38.8l2.1-11.9L7 18.5l11.8-1.6L24 6Z"
        fill={C.yellow}
        stroke={C.navy}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  ),
  heart: (
    <g>
      <path
        d="M24 40S6 29 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 11-18 22-18 22Z"
        fill={C.coral}
        stroke={C.navy}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  ),
  clock: (
    <g>
      <circle cx="24" cy="24" r="18" fill={C.mintSoft} stroke={C.navy} strokeWidth="2.5" />
      <path d="M24 13v11l8 5" stroke={C.purple} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  ),
  box: (
    <g>
      <path d="M24 7 42 15v18l-18 8-18-8V15L24 7Z" fill={C.yellowSoft} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M6 15l18 8 18-8M24 23v18" stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <rect x="20" y="9" width="8" height="10" rx="2" fill={C.coral} />
    </g>
  ),
  truck: (
    <g>
      <rect x="4" y="15" width="24" height="17" rx="3" fill={C.purple} />
      <path d="M28 20h7l7 7v5H28V20Z" fill={C.purpleSoft} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="15" cy="35" r="4.5" fill={C.navy} />
      <circle cx="34" cy="35" r="4.5" fill={C.navy} />
      <circle cx="15" cy="35" r="1.8" fill={C.white} />
      <circle cx="34" cy="35" r="1.8" fill={C.white} />
    </g>
  ),
  plant: (
    <g>
      <path d="M13 28h22l-2.5 12a3 3 0 0 1-3 2.5h-11a3 3 0 0 1-3-2.5L13 28Z" fill={C.coral} />
      <rect x="11" y="24" width="26" height="6" rx="3" fill={C.coralSoft} />
      <path d="M24 24V12" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="17" cy="13" rx="7" ry="5" transform="rotate(-25 17 13)" fill={C.mint} />
      <ellipse cx="31" cy="15" rx="6" ry="4.5" transform="rotate(25 31 15)" fill={C.mint} />
    </g>
  ),
  sun: (
    <g>
      <circle cx="24" cy="24" r="10" fill={C.yellow} />
      <path
        d="M24 5v5M24 38v5M5 24h5M38 24h5M11 11l3.5 3.5M33.5 33.5 37 37M37 11l-3.5 3.5M14.5 33.5 11 37"
        stroke={C.yellow}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  ),
  droplet: (
    <g>
      <path d="M24 6c7 9 12 14 12 21a12 12 0 0 1-24 0c0-7 5-12 12-21Z" fill={C.mint} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M19 28a5 5 0 0 0 5 5" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </g>
  ),
  sparkle: (
    <g>
      <path d="M24 6c1.5 8 4 10.5 12 12-8 1.5-10.5 4-12 12-1.5-8-4-10.5-12-12 8-1.5 10.5-4 12-12Z" fill={C.purple} />
      <path d="M38 28c.8 4 2 5.2 6 6-4 .8-5.2 2-6 6-.8-4-2-5.2-6-6 4-.8 5.2-2 6-6Z" fill={C.yellow} />
      <path d="M10 30c.6 3 1.5 3.9 4.5 4.5-3 .6-3.9 1.5-4.5 4.5-.6-3-1.5-3.9-4.5-4.5 3-.6 3.9-1.5 4.5-4.5Z" fill={C.mint} />
    </g>
  ),
  shield: (
    <g>
      <path d="M24 5 40 11v13c0 9-7 16-16 19-9-3-16-10-16-19V11l16-6Z" fill={C.mintSoft} stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m17 24 5 5 10-10" stroke={C.mint} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  ),
  gift: (
    <g>
      <rect x="7" y="19" width="34" height="22" rx={r} fill={C.coralSoft} />
      <rect x="5" y="14" width="38" height="8" rx="3" fill={C.coral} />
      <rect x="20" y="14" width="8" height="27" fill={C.purple} />
      <path d="M24 14c-4-7-11-5-9 0M24 14c4-7 11-5 9 0" fill={C.purple} />
    </g>
  ),
};
