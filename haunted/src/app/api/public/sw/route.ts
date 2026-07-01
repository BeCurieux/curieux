// GET /api/public/sw → the push service worker, served THROUGH the App Proxy so
// it is same-origin with the storefront (a SW can't be registered cross-origin
// from the Shopify CDN). Service-Worker-Allowed lets it claim a broad scope.
import { NextResponse } from 'next/server';

const SW = `// Haunted Wishlist service worker (push + click). Served via App Proxy.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'A little ghost misses you';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || undefined,
      badge: data.icon || undefined,
      data: { url: data.url || '/' },
      tag: data.url || 'haunt',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  // Opening the /r deep link both attributes the click and lands on the PDP.
  event.waitUntil(clients.openWindow(url));
});
`;

export async function GET() {
  return new NextResponse(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
