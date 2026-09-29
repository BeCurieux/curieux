// Signing out an idle instructor (docs/M3_ATTENDANCE_PROGRESS.md, "Shared
// devices"). Poolside iPads are shared, so an instructor app left open
// mustn't stay signed in. The browser signs out after this long without a
// tap, and the server refuses a request that arrives after it.

export const IDLE_LIMIT_MS = 30 * 60 * 1000;

// When the signed-in person last made a request, in milliseconds. Written by
// the proxy and at sign-in; it holds no personal data.
export const LAST_SEEN_COOKIE = "ovyko_seen";

export const lastSeenCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function isIdle(lastSeen: string | undefined, now = Date.now()): boolean {
  const seen = Number(lastSeen);
  if (!lastSeen || !Number.isFinite(seen)) return false;
  return now - seen > IDLE_LIMIT_MS;
}

// Where the idle rule applies: the instructor app only.
export function isInstructorPath(pathname: string): boolean {
  return pathname === "/instructor" || pathname.startsWith("/instructor/");
}
