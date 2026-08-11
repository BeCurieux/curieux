#!/usr/bin/env python3
"""Check — and repair — the advance widths inside the Charter fonts.

The bug this exists for
-----------------------

The site is set in Charter, self-hosted as three woff2 files with CFF
outlines. Those files declare each letter's width in two places, and the two
disagreed: the `hmtx` table had the correct widths, and every single
charstring inside the `CFF ` table said zero.

That is not a corrupt file. It parses, it validates, the glyph outlines are
perfect, and 229 of 229 glyphs are wrong in the same way — the signature of
a conversion tool that wrote the outlines and forgot the widths.

Whether it *renders* wrong depends entirely on which of the two numbers the
machine reading it happens to trust. Chrome on Linux and macOS takes the
advance from `hmtx` and the page is flawless. Chrome on Windows hands the
font to DirectWrite, which takes it from the charstring, gets zero, and
draws every letter of every word at the same point. It looks like the page
has been smashed. It cost three wrong theories before anyone thought to
check whether a valid font could be lying.

The same fonts set the printed book. A rasteriser at a print house is as
entitled to read the CFF widths as DirectWrite is, so this was not only a
website bug — it was a book that could have come back from the printer with
every page an unreadable smudge.

The repair
----------

Lossless, and small. A Type 2 charstring may carry its width as an optional
first operand, and all 229 in each file begin with a move operator, which is
exactly where that operand is allowed to sit. There are no subroutines, so
nothing is shared and nothing else can be disturbed. So each charstring gets
its true width — read from `hmtx`, which was right all along — prepended.
Not one outline is touched.

Usage
-----

    pip install fonttools brotli
    python3 scripts/fix-cff-widths.py            # report
    python3 scripts/fix-cff-widths.py --fix      # repair in place

Run the report after changing or replacing any typeface. A font that fails
here looks perfect on the machine you are developing on.
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.misc.psCharStrings import T2WidthExtractor

FONTS = sorted((Path(__file__).parent.parent / "src" / "fonts").glob("*.woff2"))

# Operators a width operand is allowed to precede. Anything else means the
# charstring is shaped in a way this repair does not understand, and it
# should be left alone rather than guessed at.
TAKES_WIDTH = {"hstem", "hstemhm", "vstem", "vstemhm", "cntrmask", "hintmask",
               "rmoveto", "hmoveto", "vmoveto", "endchar"}


def widths(font):
    """What each charstring says its width is, against what hmtx says."""
    cff = font["CFF "].cff
    top = cff[cff.fontNames[0]]
    hmtx = font["hmtx"]
    out = {}
    for name in top.CharStrings.keys():
        cs = top.CharStrings[name]
        extractor = T2WidthExtractor(
            getattr(cs.private, "Subrs", []) or [],
            cs.globalSubrs,
            top.Private.nominalWidthX,
            top.Private.defaultWidthX,
        )
        extractor.execute(cs)
        out[name] = (extractor.width, hmtx.metrics[name][0])
    return out


def repair(font):
    """Write the true width into every charstring. Returns how many changed."""
    cff = font["CFF "].cff
    top = cff[cff.fontNames[0]]
    hmtx = font["hmtx"]

    # Both set to zero, so an encoded operand is the width itself and a glyph
    # of genuinely zero width is correctly represented by omitting it.
    top.Private.nominalWidthX = 0
    top.Private.defaultWidthX = 0

    changed = 0
    for name in top.CharStrings.keys():
        cs = top.CharStrings[name]
        cs.decompile()
        operators = [tok for tok in cs.program if isinstance(tok, str)]
        if not operators or operators[0] not in TAKES_WIDTH:
            raise SystemExit(
                f"{name} begins with {operators[:1]}, which cannot carry a width. "
                "Repair abandoned rather than guessed at."
            )
        width = hmtx.metrics[name][0]
        if width == 0:
            continue  # correctly represented by defaultWidthX
        cs.program = [width] + cs.program
        changed += 1
    return changed


def main():
    fix = "--fix" in sys.argv
    if not FONTS:
        raise SystemExit("No fonts found.")

    broken_files = 0
    for path in FONTS:
        font = TTFont(path)
        wrong = {n: v for n, v in widths(font).items() if v[0] != v[1]}

        if not wrong:
            print(f"✓ {path.name} — all {len(widths(font))} glyphs agree with hmtx.")
            continue

        broken_files += 1
        sample = list(wrong.items())[:4]
        print(
            f"✗ {path.name} — {len(wrong)} glyphs carry a width the hmtx table "
            f"contradicts, e.g. " +
            ", ".join(f"{n} says {cff} not {hm}" for n, (cff, hm) in sample)
        )

        if not fix:
            continue

        changed = repair(font)
        font.flavor = "woff2"
        font.save(path)

        # Verified by reading the file back, not by trusting the write. The
        # whole reason this bug survived was a font that was believed rather
        # than measured.
        after = widths(TTFont(path))
        still = {n: v for n, v in after.items() if v[0] != v[1]}
        if still:
            raise SystemExit(f"  Repair did not take: {len(still)} still wrong.")
        print(f"  repaired {changed} glyphs, re-read, and all agree. "
              f"{path.stat().st_size} bytes.")

    if broken_files and not fix:
        print(f"\n{broken_files} font(s) need repairing. Run again with --fix.")
        return 1
    print("\nEvery glyph's width agrees with hmtx." if not broken_files else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
