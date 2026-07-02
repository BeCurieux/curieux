// Thin client for the Waterline backend (server/). The prototype currently
// computes margins locally from src/lib/data.js + compute.js so it runs with no
// server; this client lets the UI switch to live backend data instead.
//
// Point it at the API with VITE_API_BASE (e.g. http://localhost:8791). When
// unset, `isLiveBackend` is false and callers should fall back to local compute.

import { getSessionToken } from './appbridge.js'

const BASE = import.meta.env?.VITE_API_BASE || ''
export const isLiveBackend = !!BASE

async function req(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  // When embedded in Shopify admin, attach the App Bridge session token so the
  // backend can identify the shop (for billing). No-op standalone.
  const token = await getSessionToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  health: () => req('/api/health'),
  store: () => req('/api/store'),

  // margins workspace
  margins: (range = '30d') => req(`/api/margins?range=${range}`),
  products: (range = '30d') => req(`/api/products?range=${range}`),
  product: (id, range = '30d') => req(`/api/products/${id}?range=${range}`),

  // cost inputs
  costInputs: (range = '30d') => req(`/api/cost-inputs?range=${range}`),
  setCogs: (id, cogsPerUnit, range = '30d') => req(`/api/cost-inputs/${id}/cogs?range=${range}`, { method: 'POST', body: { cogsPerUnit } }),

  // autopilot
  autopilot: (range = '30d') => req(`/api/autopilot?range=${range}`),
  setAutopilot: (patch) => req('/api/autopilot', { method: 'POST', body: patch }),
  togglePlay: (id, range = '30d') => req(`/api/autopilot/plays/${id}/toggle?range=${range}`, { method: 'POST' }),
  enableAllPlays: (range = '30d') => req(`/api/autopilot/plays/enable-all?range=${range}`, { method: 'POST' }),
  revertLedger: (id) => req(`/api/autopilot/ledger/${id}/revert`, { method: 'POST' }),
  toggleGuardrail: (index) => req(`/api/autopilot/guardrails/${index}/toggle`, { method: 'POST' }),

  // alerts
  alerts: () => req('/api/alerts'),
  dismissAlert: (id) => req(`/api/alerts/${id}/dismiss`, { method: 'POST' }),
  toggleAlertRule: (index) => req(`/api/alerts/rules/${index}/toggle`, { method: 'POST' }),

  // trust surface
  actionLog: () => req('/api/action-log'),

  // pull fresh data from the connected Shopify store
  sync: () => req('/api/sync', { method: 'POST' }),

  // billing (hybrid Autopilot+)
  billingStatus: () => req('/api/billing/status'),
  subscribe: () => req('/api/billing/subscribe', { method: 'POST' }),
}
