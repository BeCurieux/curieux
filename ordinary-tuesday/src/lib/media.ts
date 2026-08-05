// Media helpers: checksums, duplicate detection, minimal image metadata.
// Kept dependency-free — dimensions are parsed from JPEG/PNG headers.

import { createHash } from "node:crypto";

export function sha256(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export interface ImageMeta {
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

/** Parse dimensions from PNG or JPEG bytes without external libraries. */
export function readImageMeta(buf: Buffer): ImageMeta {
  // PNG: 8-byte signature, then IHDR with width/height at offsets 16/20.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      mimeType: "image/png",
    };
  }
  // JPEG: scan segments for SOF0/1/2 which carry dimensions.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      const size = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc2) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
          mimeType: "image/jpeg",
        };
      }
      offset += 2 + size;
    }
    return { width: null, height: null, mimeType: "image/jpeg" };
  }
  return { width: null, height: null, mimeType: null };
}

/** Storage path convention enforced by RLS: <user_id>/<subject_id>/<name> */
export function mediaPath(userId: string, subjectId: string, checksum: string, ext: string): string {
  return `${userId}/${subjectId}/${checksum}.${ext.replace(/[^a-z0-9]/gi, "")}`;
}
