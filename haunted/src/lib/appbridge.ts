// Thin client helper for talking to the admin API with a Shopify session token.
// App Bridge v4 exposes window.shopify.idToken(). We attach it as a bearer so the
// server can derive the shop from a verified token (never from the client body).

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (typeof window !== 'undefined' && window.shopify?.idToken) {
    const token = await window.shopify.idToken();
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { ...(await authHeader()) } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}
