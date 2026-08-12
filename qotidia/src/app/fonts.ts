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
// The two faces divide by what the words *are*, not by how big they are:
// Charter sets anything the archive is about — a memory, a quote, a name, a
// heading — and the system sans sets everything that is the product talking
// about itself: navigation, buttons, labels, counts, dates. The interface
// baseline is the sans. The full rationale lives in tailwind.config.ts under
// `fontFamily`; this file only loads the face.
//
// One thing to know before replacing any of these files. An OpenType font
// with CFF outlines states each letter's width twice — once in the `hmtx`
// table and once inside the glyph's own charstring — and nothing requires
// the two to agree. The files first shipped here had correct widths in
// `hmtx` and zero in all 229 charstrings, which is what a conversion tool
// produces when it writes the shapes and forgets the spacing.
//
// It renders perfectly on Linux and macOS, which read `hmtx`. Chrome on
// Windows hands the font to DirectWrite, which reads the charstring, and
// every letter of every word lands on the same point. The site looked
// destroyed on one machine and flawless on another, from the same commit.
//
// The books are set in these same files, so a rasteriser at a print house
// could have made the same choice DirectWrite did.
//
// `python3 scripts/fix-cff-widths.py` reports and repairs it. Run it after
// touching anything in ../fonts — this is not a fault you will see on the
// machine you are working on.

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
