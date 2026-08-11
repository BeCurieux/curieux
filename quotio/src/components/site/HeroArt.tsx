// The hero scene.
//
// Marketing art, deliberately kept out of src/components/illustrations —
// those are a controlled vocabulary that widget authors pick from, this is a
// one-off drawing that belongs to the homepage.
//
// It's the piece that makes the page feel made rather than assembled: a small
// character with a pencil, mid-edit on a widget, on a peach blob. Friendly,
// not childish — flat shapes, brand palette, no gradients, no shading.

const C = {
  purple: "#5B5FEF",
  purpleSoft: "#DDDEFC",
  mint: "#7DD3C7",
  yellow: "#FFC857",
  coral: "#FF8FA3",
  navy: "#1B1F3B",
  peach: "#FDEBD8",
  cream: "#FFF4DE",
  white: "#FFFFFF",
  rule: "#E7EAF6",
} as const;

/**
 * Foliage tucked into the corner of the hero widget.
 *
 * Deliberately part of the *page*, not the widget runtime. In the reference
 * these leaves overlap the widget card as part of the hero composition — but
 * a widget is embedded on other people's sites, and a removals firm should
 * not find houseplants growing out of their quote form. If it should be
 * available inside widgets it belongs in the theme system as an opt-in, not
 * baked into the renderer.
 */
export function HeroLeaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 140" fill="none" className={className} aria-hidden="true">
      <circle cx="52" cy="120" r="34" fill={C.yellow} opacity="0.55" />

      <g fill={C.mint}>
        <path d="M104 138c-14-6-22-20-20-36 15 3 26 15 27 31l-7 5Z" />
        <path d="M116 132c-6-20 2-41 20-52 8 19 3 41-12 53l-8-1Z" />
        <path d="M138 138c2-16 14-29 30-33 1 15-8 29-22 35l-8-2Z" />
      </g>
      <g stroke="#4FB3A2" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <path d="M100 136c-6-9-9-19-9-29M126 131c-3-14 0-28 8-40M148 136c2-9 8-17 16-22" />
      </g>
    </svg>
  );
}

export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 170"
      fill="none"
      className={className}
      role="img"
      aria-label="A character editing an interactive widget"
    >
      {/* The blush the whole scene sits on. */}
      <ellipse cx="150" cy="130" rx="140" ry="34" fill={C.peach} />
      <circle cx="232" cy="60" r="30" fill={C.cream} />

      {/* --- the browser card ---------------------------------------- */}
      <g>
        <rect x="118" y="34" width="152" height="94" rx="12" fill={C.white} stroke={C.navy} strokeWidth="2.5" />
        <path d="M118 52h152" stroke={C.navy} strokeWidth="2.5" />
        <circle cx="131" cy="43" r="2.6" fill={C.coral} />
        <circle cx="141" cy="43" r="2.6" fill={C.yellow} />
        <circle cx="151" cy="43" r="2.6" fill={C.mint} />

        {/* image placeholder */}
        <rect x="130" y="62" width="52" height="40" rx="7" fill={C.purpleSoft} />
        <circle cx="144" cy="75" r="4" fill={C.white} />
        <path d="M133 98l13-13 9 9 7-6 9 12h-38Z" fill={C.white} opacity="0.85" />

        {/* copy lines */}
        <rect x="192" y="64" width="62" height="7" rx="3.5" fill={C.coral} />
        <rect x="192" y="78" width="46" height="6" rx="3" fill={C.rule} />
        <rect x="192" y="90" width="56" height="6" rx="3" fill={C.rule} />

        {/* a slider, mid-drag */}
        <rect x="130" y="112" width="124" height="6" rx="3" fill={C.rule} />
        <rect x="130" y="112" width="66" height="6" rx="3" fill={C.purple} />
        <circle cx="196" cy="115" r="9" fill={C.white} stroke={C.purple} strokeWidth="3.5" />
      </g>

      {/* the add button, tucked on the corner */}
      <circle cx="266" cy="120" r="14" fill={C.purple} />
      <path d="M266 114v12M260 120h12" stroke={C.white} strokeWidth="3" strokeLinecap="round" />

      {/* --- the character -------------------------------------------- */}
      <g>
        {/* legs */}
        <path d="M46 118v14M66 118v14" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
        <path d="M40 133h9M62 133h9" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />

        {/* body */}
        <rect x="26" y="46" width="60" height="74" rx="22" fill={C.purple} />

        {/* face */}
        <circle cx="46" cy="80" r="5.4" fill={C.white} />
        <circle cx="68" cy="80" r="5.4" fill={C.white} />
        <circle cx="47" cy="81" r="2.4" fill={C.navy} />
        <circle cx="69" cy="81" r="2.4" fill={C.navy} />
        <path
          d="M47 95c3.4 4 7 5.6 10 5.6s6.6-1.6 10-5.6"
          stroke={C.navy}
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* arms */}
        <path d="M26 84c-8 2-13 7-15 13" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
        <path d="M86 82c7 1 12 5 15 10" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />

        {/* the pencil */}
        <g transform="rotate(38 20 104)">
          <rect x="4" y="98" width="36" height="11" rx="2" fill={C.yellow} />
          <rect x="34" y="98" width="7" height="11" fill={C.coral} />
          <path d="M4 98l-8 5.5L4 109V98Z" fill={C.navy} />
        </g>

        {/* the little spark of an idea */}
        <path
          d="M96 40c1.2 6 3.2 8 9 9.2-5.8 1.2-7.8 3.2-9 9-1.2-5.8-3.2-7.8-9-9 5.8-1.2 7.8-3.2 9-9.2Z"
          fill={C.yellow}
        />
      </g>
    </svg>
  );
}
