/**
 * The drawn marks.
 *
 * Three small SVGs, inline rather than an icon package: at this count a
 * dependency costs more than the paths do, and inlining means they inherit
 * `currentColor` and land in the same request as the page.
 *
 * They are deliberately a little wonky — uneven arms on the sparkle, a heart
 * that does not close symmetrically. A perfectly geometric mark reads as a UI
 * kit; these read as drawn, which is the brand board's whole texture note.
 */

export function Sparkle({ className = "sparkle" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.4c.5 4.6 1.9 6.7 6.4 7.6-4.4.9-5.9 3-6.4 7.6-.5-4.6-1.9-6.7-6.4-7.6 4.5-.9 5.9-3 6.4-7.6Z"
        fill="currentColor"
      />
      <path
        d="M19.2 15.4c.24 2.1.88 3.05 2.9 3.45-2 .4-2.66 1.36-2.9 3.45-.23-2.09-.87-3.05-2.9-3.45 2.03-.4 2.67-1.35 2.9-3.45Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

export function CopyMark({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.8 4.4 4.3L19 7.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8.6" y="8.6" width="11.4" height="11.4" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M15.4 5.2H7a2.8 2.8 0 0 0-2.8 2.8v8.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The doodle in the corner of the offer band. */
export function HeartScribble({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M50 84C34 72 16 60 16 42.5 16 31 25 22 36 22c6.2 0 11.6 3 14.6 7.6C53.4 25 58.8 22 65 22c11 0 20 9 20 20.5C85 58 70 70 50 84Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
