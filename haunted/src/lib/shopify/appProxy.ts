// App Proxy signature verification (CLAUDE.md §data model: derive shop_id from
// the verified app-proxy signature — never trust a shop_id from the client).
// The storefront app block calls the public wishlist/push endpoints through the
// Shopify App Proxy, which appends a `signature` computed over the sorted query
// params with the app secret. Verify it, then trust `shop` from the query.

import crypto from 'node:crypto';

export function verifyAppProxySignature(url: URL): { shop: string } | null {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return null;

  const params = new URLSearchParams(url.search);
  const signature = params.get('signature');
  if (!signature) return null;
  params.delete('signature');

  // Sort keys; join each as key=value (values concatenated without separators
  // for repeated keys, per Shopify's spec).
  const entries: Record<string, string[]> = {};
  for (const [k, v] of params.entries()) (entries[k] ??= []).push(v);
  const message = Object.keys(entries)
    .sort()
    .map((k) => `${k}=${entries[k]!.join(',')}`)
    .join('');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    ok = false;
  }
  if (!ok) return null;

  const shop = params.get('shop');
  if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return { shop };
}
