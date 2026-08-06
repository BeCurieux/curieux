// Typefaces.
//
// The site used to run entirely on OS font stacks, which meant it rendered
// in Iowan Old Style on a Mac, Palatino on Windows, Noto on Android and
// Liberation Serif on Linux — four different brands — while the book was set
// in Charter. Someone who saw the website and then the object was looking at
// two different companies.
//
// So the site is now set in Charter too, self-hosted. Matthew Carter drew it
// for printing on equipment that could not hold fine detail, which is exactly
// why it survives being set small on uncoated paper — and, as it happens,
// why it holds up on a screen.
//
// Licensing: this is the Bitstream Charter that Bitstream donated to the X
// Consortium, redistributable including in modified form. Worth confirming
// before launch, as with any font you ship.
//
// The sans is kept for functional micro-type only — form fields, buttons,
// small labels — the same division the printed page makes.

import localFont from "next/font/local";

export const charter = localFont({
  src: [
    { path: "../fonts/Charter-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Charter-Italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/Charter-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-charter",
  display: "swap",
  // Metric fallback, so the page does not reflow when Charter arrives.
  fallback: ["Georgia", "Times New Roman", "serif"],
});
