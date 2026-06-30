// App Bridge session tokens. When Waterline runs embedded inside Shopify admin,
// the frontend gets a short-lived session token (a JWT signed with the app's
// client secret, HS256) on every request. We verify it here to learn which shop
// is calling, then look up that shop's offline access token in db.tokens.
//
// Inert without SHOPIFY_API_SECRET — verifySessionToken() returns null and the
// API falls back to the demo store, so the standalone deploy keeps working.

import crypto from 'node:crypto'

const API_KEY = process.env.SHOPIFY_API_KEY
const API_SECRET = process.env.SHOPIFY_API_SECRET

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const b64urlJson = (s) => JSON.parse(b64urlToBuf(s).toString('utf8'))

// Verify a Shopify App Bridge session token. Returns { shop } on success, else null.
export function verifySessionToken(token) {
  if (!API_SECRET || !token) return null
  try {
    const [h, p, sig] = token.split('.')
    if (!h || !p || !sig) return null
    const expected = crypto.createHmac('sha256', API_SECRET).update(`${h}.${p}`).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (!safeEqual(expected, sig)) return null
    const claims = b64urlJson(p)
    const now = Math.floor(Date.now() / 1000)
    if (claims.exp && now >= claims.exp) return null
    if (claims.nbf && now < claims.nbf) return null
    if (API_KEY && claims.aud && claims.aud !== API_KEY) return null
    // `dest` is the shop's admin URL, e.g. https://acme.myshopify.com
    const shop = claims.dest ? claims.dest.replace(/^https?:\/\//, '') : null
    if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) return null
    return { shop }
  } catch {
    return null
  }
}

// Express helper: pull the bearer token off Authorization and resolve the shop.
export function shopFromRequest(req) {
  const auth = req.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  return verifySessionToken(token)
}

function safeEqual(a, b) {
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) } catch { return false }
}
