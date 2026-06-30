// Thin client for the Lattice backend (server/). The prototype computes
// everything locally from src/lib/data.js + compute.js so it runs with no
// server; this client lets the UI switch to live backend data instead.
//
// Point it at the API with VITE_API_BASE (e.g. http://localhost:8788). When
// unset, `isLiveBackend` is false and callers fall back to local data.

const BASE = import.meta.env?.VITE_API_BASE || ''
export const isLiveBackend = !!BASE

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  health: () => req('/api/health'),
  store: () => req('/api/store'),

  home: () => req('/api/home'),
  bundles: () => req('/api/bundles'),
  bundle: (id) => req(`/api/bundles/${id}`),

  feeds: () => req('/api/feeds'),
  resyncFeeds: () => req('/api/feeds/resync', { method: 'POST' }),

  subscriptions: () => req('/api/subscriptions'),

  inventory: () => req('/api/inventory'),
  setRouting: (on) => req('/api/inventory/routing', { method: 'POST', body: { on } }),
  setStock: (componentId, warehouseId, qty) =>
    req(`/api/inventory/${componentId}/stock`, { method: 'POST', body: { warehouseId, qty } }),

  performance: () => req('/api/performance'),
  analytics: () => req('/api/analytics'),

  actionLog: () => req('/api/action-log'),
}
