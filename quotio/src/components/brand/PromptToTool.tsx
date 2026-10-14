// The prompt → tool mark.
//
// The supporting half of the identity: the wordmark says who, this says what.
// A text cursor with a few keystrokes coming off it, an arrow, and a finished
// tool — sentence in, working thing out. It is deliberately not a wand or a
// spark, because those say "magic happened" rather than "you described it and
// got the thing".
//
// Mint and coral live here and nowhere else in the chrome: this is a picture
// of a product, and a picture of a product is allowed the product's colours.

const NAVY = "#18233A";
const VIOLET = "#7657F6";
const MINT = "#73DDB5";
const CORAL = "#FF806F";
const RULE = "#D9DEEC";

export function PromptToTool({
  height = 64,
  className,
  title = "Describe it, get a working tool",
}: {
  height?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={Math.round((height * 148) / 72)}
      height={height}
      viewBox="0 0 148 72"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      {/* The cursor you type into. Ink follows `currentColor` so the mark
          reverses on navy — drawn in a fixed navy it simply disappeared. */}
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <path d="M16 16v40M9 16h14M9 56h14" />
      </g>

      {/* Keystrokes leaving it — three marks, not a starburst. */}
      <g stroke={VIOLET} strokeWidth="4.5" strokeLinecap="round">
        <path d="M31 25l8-4M32 36h9M31 47l8 4" />
      </g>

      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M52 36h13M60 30l6 6-6 6" />
      </g>

      {/* The tool that comes out. */}
      <g>
        <rect x="78" y="10" width="62" height="52" rx="12" fill="#FFFFFF" />
        <path
          d="M78 22a12 12 0 0 1 12-12h38a12 12 0 0 1 12 12z"
          fill={VIOLET}
        />
        <rect x="78.75" y="10.75" width="60.5" height="50.5" rx="11.25" stroke="currentColor" strokeWidth="3.5" />

        {/* A question and its answers, in miniature. */}
        <rect x="88" y="30" width="30" height="4.5" rx="2.25" fill={RULE} />
        <rect x="88" y="39" width="20" height="4.5" rx="2.25" fill={RULE} />
        <circle cx="91" cy="52" r="4" fill={MINT} />
        <rect x="99" y="48.5" width="14" height="7.5" rx="3.75" fill={CORAL} />
        <rect x="117" y="48.5" width="14" height="7.5" rx="3.75" fill={VIOLET} />
      </g>
    </svg>
  );
}

/**
 * The same idea squared off, for places that need a tile rather than a strip:
 * just the tool, on violet, with the cursor tucked in beside it.
 */
export function PromptToToolTile({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Describe it, get a working tool"
      className={className}
    >
      <rect width="120" height="120" rx="30" fill={VIOLET} />
      <rect x="26" y="26" width="68" height="68" rx="16" fill="#FFF9F1" />
      <path d="M26 42a16 16 0 0 1 16-16h36a16 16 0 0 1 16 16z" fill={NAVY} />
      <rect x="38" y="52" width="34" height="6" rx="3" fill={RULE} />
      <rect x="38" y="64" width="22" height="6" rx="3" fill={RULE} />
      <circle cx="42" cy="82" r="5" fill={MINT} />
      <rect x="53" y="77" width="17" height="10" rx="5" fill={CORAL} />
      <rect x="74" y="77" width="17" height="10" rx="5" fill={VIOLET} />
    </svg>
  );
}
