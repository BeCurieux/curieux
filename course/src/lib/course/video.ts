import { createHash } from "node:crypto";

// The player URL for a lesson video (SPEC.md → Stack: Bunny Stream, or
// unlisted YouTube for v1). Built on the server, only after the lesson's
// access check, so the id never reaches someone who can't watch it.
//
// Bunny: with BUNNY_STREAM_TOKEN_KEY set (Stream → library → Security →
// Embed view token authentication), each URL is signed and expires, so a
// copied embed link stops working. Bunny's scheme: SHA-256 hex of
// token key + video id + expiry (Unix seconds).

export interface VideoConfig {
  bunnyLibraryId?: string;
  bunnyTokenKey?: string;
}

const TOKEN_LIFETIME_SECONDS = 6 * 60 * 60; // a long lesson, paused and resumed

export function videoEmbedUrl(
  provider: "bunny" | "youtube",
  videoId: string,
  config: VideoConfig,
  now = Date.now(),
): string | null {
  const id = encodeURIComponent(videoId);
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  if (!config.bunnyLibraryId) return null;
  const base = `https://iframe.mediadelivery.net/embed/${encodeURIComponent(config.bunnyLibraryId)}/${id}`;
  if (!config.bunnyTokenKey) return base;
  const expires = Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS;
  const token = createHash("sha256")
    .update(`${config.bunnyTokenKey}${videoId}${expires}`)
    .digest("hex");
  return `${base}?token=${token}&expires=${expires}`;
}
