// Shopify App Bridge — only active when Waterline is embedded inside Shopify
// admin (URL carries a `host` param) AND VITE_SHOPIFY_API_KEY is set at build
// time. Otherwise every export is a no-op and the app runs standalone exactly as
// before (demo deploy, local dev).
//
// App Bridge v4 loads from Shopify's CDN and exposes window.shopify. We use it
// for one thing here: getSessionToken(), a short-lived JWT the backend verifies
// (server/session.js) to identify the calling shop for billing.

const API_KEY = import.meta.env?.VITE_SHOPIFY_API_KEY || ''

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const host = params.get('host')

// Embedded only when we have both an API key and a host param from Shopify admin.
export const isEmbedded = !!API_KEY && !!host

let ready = null

// Inject App Bridge from Shopify's CDN (must carry the api-key meta tag first).
export function initAppBridge() {
  if (!isEmbedded || typeof document === 'undefined') return
  if (ready) return ready
  ready = new Promise((resolve) => {
    const meta = document.createElement('meta')
    meta.name = 'shopify-api-key'
    meta.content = API_KEY
    document.head.appendChild(meta)
    const s = document.createElement('script')
    s.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return ready
}

// Resolve a fresh session token, or null when not embedded / unavailable.
export async function getSessionToken() {
  if (!isEmbedded) return null
  try {
    await initAppBridge()
    if (window.shopify?.idToken) return await window.shopify.idToken()
  } catch { /* fall through */ }
  return null
}

// The shop domain Shopify embedded us for, if derivable from `host`.
export function embeddedShop() {
  if (!host) return null
  try {
    // host is base64(<shop>.myshopify.com/admin)
    const decoded = atob(host.replace(/-/g, '+').replace(/_/g, '/'))
    const m = decoded.match(/([a-zA-Z0-9-]+\.myshopify\.com)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}
