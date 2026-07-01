// Session-token auth for the embedded admin (CLAUDE.md §Stack: session tokens).
// App Bridge issues a short-lived JWT signed with the app's client secret (HS256);
// the admin API routes verify it and derive the shop domain — never trusting a
// shop passed in the body.

import crypto from 'node:crypto';

export interface SessionClaims {
  dest: string; // https://{shop}.myshopify.com
  aud: string; // API key
  sub: string; // user id
  exp: number;
  iss: string;
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verify an App Bridge session token and return the shop domain, or null.
export function verifySessionToken(token: string | null): { shop: string } | null {
  if (!token) return null;
  const secret = process.env.SHOPIFY_API_SECRET;
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!secret || !apiKey) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest();
  const given = b64urlToBuf(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(b64urlToBuf(payload).toString('utf8')) as SessionClaims;
  } catch {
    return null;
  }
  if (claims.aud !== apiKey) return null;
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;

  try {
    const host = new URL(claims.dest).host; // {shop}.myshopify.com
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(host)) return null;
    return { shop: host };
  } catch {
    return null;
  }
}

// Convenience for route handlers: pull the bearer token from Authorization.
export function shopFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return verifySessionToken(token)?.shop ?? null;
}
