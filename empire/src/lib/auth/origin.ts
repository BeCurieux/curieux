// The address she's actually on. Sign-in links must come back to the same
// host she asked from: the one-time code's verifier cookie lives there, and
// so will her session. The same studio can answer on several hosts (Vercel's
// branch and per-deploy preview URLs; the custom domain with or without
// www), so APP_URL is only the fallback.
//
// A forged Host header can't send a link anywhere unexpected: Supabase only
// redirects to URLs on the project's allow list.

const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function requestOrigin(headers: Headers, fallback: string): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0]!.trim();
  if (!HOST.test(host)) return fallback;
  const forwarded = (headers.get("x-forwarded-proto") ?? "").split(",")[0]!.trim();
  const proto =
    forwarded === "http" || forwarded === "https"
      ? forwarded
      : fallback.startsWith("https:")
        ? "https"
        : "http";
  return `${proto}://${host}`;
}
