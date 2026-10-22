// Upload checks that don't trust the browser: the file type comes from the
// file's first bytes, not its name or the Content-Type the browser sent.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function checkUpload(bytes: Uint8Array): { ok: true; type: ImageType } | { ok: false; message: string } {
  if (bytes.length === 0) return { ok: false, message: "That file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, message: "Images can be up to 5 MB." };
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "Upload a JPEG, PNG or WebP image." };
  return { ok: true, type };
}

/** `<userId>/<uuid>.<ext>` and nothing else: no traversal, no other folders. */
export function isOwnedPath(path: string, userId: string): boolean {
  return new RegExp(`^${userId.replace(/[^a-f0-9-]/gi, "")}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(path);
}
