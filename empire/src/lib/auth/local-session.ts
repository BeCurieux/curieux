import { createHmac, timingSafeEqual } from "node:crypto";

// The local backend's session cookie: `<userId>.<email>.<expiry>.<signature>`,
// HMAC-SHA256 signed. Local development and tests only — production uses
// Supabase Auth. Pure functions so they can be tested without a request.

export const LOCAL_SESSION_COOKIE = "empire_local_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createLocalSession(
  user: { id: string; email: string },
  secret: string,
  now = Date.now(),
): { value: string; maxAge: number } {
  const expires = Math.floor(now / 1000) + MAX_AGE_SECONDS;
  const payload = `${encode(user.id)}.${encode(user.email)}.${expires}`;
  return { value: `${payload}.${sign(payload, secret)}`, maxAge: MAX_AGE_SECONDS };
}

export function readLocalSession(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): { id: string; email: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [id, email, expires, signature] = parts as [string, string, string, string];
  const expected = Buffer.from(sign(`${id}.${email}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) * 1000 < now) return null;
  return { id: decode(id), email: decode(email) };
}
