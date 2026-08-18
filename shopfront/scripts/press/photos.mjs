#!/usr/bin/env node
/**
 * Normalise whatever photographs somebody dropped into `public/demo/`.
 *
 * Two things go wrong when photographs arrive by hand, and both of them are
 * quiet.
 *
 * **Weight.** These came in as 1024×1024 PNGs at about 1.7MB each. Six of them
 * on one shop page is ten megabytes, sent to a phone, over mobile data, for a
 * page whose entire premise is that it opens fast from a link in a bio. A
 * JPEG at the same dimensions is under a fifth of that and no worse to look
 * at, because these are photographs rather than flat colour.
 *
 * **Shape.** The plate crops to 4:5 with `object-fit: cover`, so a square
 * source has 20% of its width thrown away at render time on every single
 * view. Cropping once, here, means the bytes on the wire are bytes somebody
 * actually sees.
 *
 * The source is archived out of `public/` rather than left beside the output.
 * Keeping it matters — a crop is lossy, and the next change of mind about
 * aspect ratio should not need the photographer again — but keeping it *here*
 * would mean shipping the 1.7MB original to anyone who guessed the URL, and
 * committing it to a directory whose whole purpose is what the site serves.
 * It goes to `design/photo-sources/<brand>/` instead.
 *
 *   node scripts/press/photos.mjs
 */

import { readdir, stat, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEMO = path.join(process.cwd(), "public", "demo");
/** Where originals go: kept, versioned, and not served. */
const SOURCES = path.join(process.cwd(), "design", "photo-sources");

/** What the plate crops to. Matching it here means no wasted pixels. */
const WIDTH = 1200;
const HEIGHT = 1500;

/** Sources to convert. `.jpg` is excluded so output is never an input. */
const SOURCE = /\.(png|webp|avif|tiff?)$/i;

async function brands() {
  const entries = await readdir(DEMO, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

let converted = 0;

for (const brand of await brands()) {
  const dir = path.join(DEMO, brand);
  for (const file of await readdir(dir)) {
    if (!SOURCE.test(file)) continue;

    const from = path.join(dir, file);
    const to = path.join(dir, `${file.replace(SOURCE, "")}.jpg`);

    const before = (await stat(from)).size;
    await sharp(from)
      // `cover` with a centre crop: these are product shots with the subject
      // in the middle, and the alternative — padding to fit — would put bars
      // on a page that has its own background treatment.
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(to);
    const after = (await stat(to)).size;

    const archive = path.join(SOURCES, brand);
    await mkdir(archive, { recursive: true });
    await rename(from, path.join(archive, file));

    converted += 1;
    process.stdout.write(
      `  ${brand}/${file.padEnd(22)} ${(before / 1024).toFixed(0).padStart(5)}KB → ` +
        `${(after / 1024).toFixed(0).padStart(4)}KB  ${path.basename(to)}  (source archived)\n`,
    );
  }
}

process.stdout.write(
  converted === 0
    ? "\n  Nothing to convert. Photographs go in public/demo/<brand>/<handle>.<ext>.\n\n"
    : `\n  ${converted} converted. Originals moved to design/photo-sources/ — kept, versioned, and not served.\n\n`,
);
