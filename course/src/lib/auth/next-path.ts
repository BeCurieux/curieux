// Where to send someone after sign-in. Only paths on this site, and only the
// signed-in areas, so a crafted link can't bounce her somewhere else.

export const DEFAULT_NEXT = "/learn";

const ALLOWED = ["/learn", "/tools", "/verdict", "/account", "/checkout", "/admin"];

export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) return DEFAULT_NEXT;
  let url: URL;
  try {
    url = new URL(path, "https://example.invalid");
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== "https://example.invalid") return DEFAULT_NEXT;
  const ok = ALLOWED.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  return ok ? `${url.pathname}${url.search}` : DEFAULT_NEXT;
}
