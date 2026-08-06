// When a photograph was taken.
//
// This exists so the Memory Inbox can be empty. A parent who shares twenty
// photographs and finds twenty items waiting to be dated has been handed
// twenty chores; almost every one of those photographs already carries the
// answer, and the only reason to ask would be that nobody looked.
//
// It reads EXIF DateTimeOriginal and nothing else. Not because more could
// not be parsed, but because more should not be: EXIF also carries GPS
// coordinates, camera serial numbers and, on some phones, a burst of
// identifiers that follow a device around. Reading a field means deciding to
// store it, and the answer for all of those is no. The privacy brief asked
// for far less structured information than could technically be collected,
// and a photograph's date is the one piece here that a family gets something
// back for.
//
// It lives beside the verifier because the verifier is already the one place
// that opens untrusted image bytes. Two parsers of attacker-controlled
// headers is one more than a product needs.

/**
 * The date a photograph was taken, as an ISO date.
 *
 * Null whenever there is any doubt — a stripped file, an unparseable stamp,
 * a date in the future. A wrong date is worse than none: it moves a memory
 * into the wrong year and the wrong book, and nothing downstream can tell
 * that it was a guess.
 */
export function takenOn(bytes: Buffer, now = new Date()): string | null {
  const stamp = exifDateTimeOriginal(bytes);
  if (!stamp) return null;

  // EXIF writes "2026:04:08 17:22:31". The date half is all we keep.
  const m = stamp.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;

  const [, year, month, day] = m;
  const iso = `${year}-${month}-${day}`;

  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;

  // Cameras with a flat battery cheerfully stamp 1980, and a phone with a
  // wrong clock can stamp next year. Neither is a date this archive should
  // adopt without a person saying so.
  const yearNumber = Number(year);
  if (yearNumber < 1990 || t > now.getTime() + 86_400_000) return null;

  return iso;
}

/** Tag 0x9003, DateTimeOriginal. */
const DATE_TIME_ORIGINAL = 0x9003;

/**
 * Walk far enough into a JPEG's APP1 segment to find one tag.
 *
 * Bounded everywhere and trusting nowhere: every offset a file supplies is
 * checked against the buffer before it is used, the IFD entry count is
 * capped, and anything unexpected returns null rather than throwing. These
 * are bytes a stranger emailed in.
 */
function exifDateTimeOriginal(buf: Buffer): string | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // not a JPEG

  // Find the APP1 segment carrying "Exif\0\0".
  let p = 2;
  let tiff = -1;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) break;
    const marker = buf[p + 1];
    if (marker === 0xda || marker === 0xd9) break; // image data begins; no EXIF
    const size = buf.readUInt16BE(p + 2);
    if (size < 2 || p + 2 + size > buf.length) break;
    if (marker === 0xe1 && buf.toString("latin1", p + 4, p + 10) === "Exif\0\0") {
      tiff = p + 10;
      break;
    }
    p += 2 + size;
  }
  if (tiff < 0 || tiff + 8 > buf.length) return null;

  const order = buf.toString("latin1", tiff, tiff + 2);
  if (order !== "II" && order !== "MM") return null;
  const little = order === "II";
  const u16 = (at: number) => (little ? buf.readUInt16LE(at) : buf.readUInt16BE(at));
  const u32 = (at: number) => (little ? buf.readUInt32LE(at) : buf.readUInt32BE(at));

  if (u16(tiff + 2) !== 0x002a) return null;

  const readIfd = (offset: number, depth: number): string | null => {
    // DateTimeOriginal lives in the Exif sub-IFD, one hop from IFD0. Two
    // levels is the whole journey, and the cap means a file that points an
    // IFD at itself cannot spin here.
    if (depth > 2) return null;
    const start = tiff + offset;
    if (start < tiff || start + 2 > buf.length) return null;

    const count = u16(start);
    if (count > 512) return null;
    if (start + 2 + count * 12 > buf.length) return null;

    let subIfd = -1;
    for (let i = 0; i < count; i++) {
      const entry = start + 2 + i * 12;
      const tag = u16(entry);
      const format = u16(entry + 2);
      const components = u32(entry + 4);

      if (tag === DATE_TIME_ORIGINAL && format === 2 && components >= 10 && components < 64) {
        // ASCII strings longer than four bytes live at an offset.
        const at = tiff + u32(entry + 8);
        if (at < tiff || at + components > buf.length) return null;
        return buf.toString("latin1", at, at + components).replace(/\0.*$/, "");
      }

      if (tag === 0x8769 && format === 4) subIfd = u32(entry + 8); // ExifOffset
    }

    return subIfd >= 0 ? readIfd(subIfd, depth + 1) : null;
  };

  try {
    return readIfd(u32(tiff + 4), 0);
  } catch {
    // A malformed file is a null, never a thrown scan job: the job's real
    // work is deciding whether these bytes may be served, and a date is not
    // worth failing that over.
    return null;
  }
}
