// Where to send someone after sign-in. Only our own signed-in pages are
// allowed, so a crafted link can't bounce her to another site.

export const NEXT_COOKIE = "empire_next";

const ALLOWED = ["/studio", "/account"];

export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/studio";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) return "/studio";
  let url: URL;
  try {
    url = new URL(path, "https://example.invalid");
  } catch {
    return "/studio";
  }
  if (url.origin !== "https://example.invalid") return "/studio";
  const ok = ALLOWED.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  return ok ? `${url.pathname}${url.search}` : "/studio";
}
