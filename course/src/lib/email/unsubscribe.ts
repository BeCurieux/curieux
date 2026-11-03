import { createHmac, timingSafeEqual } from "node:crypto";

// Signed unsubscribe links: anyone holding the link can unsubscribe that
// one address, nobody can unsubscribe an address they weren't sent.

export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`unsubscribe:${email.toLowerCase()}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(appUrl: string, email: string, secret: string): string {
  const e = Buffer.from(email.toLowerCase()).toString("base64url");
  return `${appUrl}/unsubscribe?e=${e}&t=${unsubscribeToken(email, secret)}`;
}

export function decodeEmail(e: string): string | null {
  try {
    const email = Buffer.from(e, "base64url").toString("utf8").toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}
