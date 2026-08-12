/**
 * A small, honest fake of a Shopify storefront.
 *
 * Deliberately not a copy of a real store's markup: it carries the structures
 * we actually depend on (og tags, JSON-LD, custom-property colour schemes,
 * /products.json shapes) and nothing else, so a test failing here means a
 * real behaviour changed rather than that someone's theme was re-released.
 */

export interface FakeRoute {
  status?: number;
  body: string;
  contentType?: string;
  /** Where the request lands after redirects — sets `Response.url`. */
  finalUrl?: string;
}

export function fakeFetch(routes: Record<string, FakeRoute>): {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  requests: string[];
} {
  const requests: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    requests.push(url);
    const route = routes[url] ?? routes[stripQuery(url)];
    if (!route) {
      return new Response("not found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }
    const response = new Response(route.body, {
      status: route.status ?? 200,
      headers: { "content-type": route.contentType ?? "text/html; charset=utf-8" },
    });
    Object.defineProperty(response, "url", { value: route.finalUrl ?? url });
    return response;
  };
  return { fetchImpl, requests };
}

function stripQuery(url: string): string {
  const index = url.indexOf("?");
  return index === -1 ? url : url.slice(0, index);
}

export const HOMEPAGE_HTML = `<!doctype html>
<html lang="en-GB">
<head>
  <title>Kelp &amp; Cotton | Slow basics for a warm house</title>
  <meta name="description" content="Slow basics for a warm house. Made in small runs in Porto, in wool and organic cotton.">
  <meta property="og:site_name" content="Kelp &amp; Cotton">
  <meta property="og:image" content="https://cdn.shopify.com/s/files/1/0001/social.jpg">
  <meta name="theme-color" content="#2f5d50">
  <link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png">
  <link rel="stylesheet" href="//cdn.shopify.com/s/files/1/0001/theme.css">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Kelp & Cotton",
     "logo":{"@type":"ImageObject","url":"https://cdn.shopify.com/s/files/1/0001/logo.svg"}}
  </script>
  <script>var Shopify = Shopify || {}; Shopify.currency = {"active":"GBP","rate":"1.0"};</script>
  <style>
    :root {
      --color-background: 250 248 244;
      --color-text: #22201d;
      --color-accent: #2f5d50;
      --color-surface: #f2eee6;
      --color-border: #ded7ca;
    }
    .button { background: #2f5d50; color: #fffdf9; }
    .badge { background: rgb(191, 87, 62); }
    .muted { color: hsl(36, 12%, 45%); }
  </style>
</head>
<body>
  <header>
    <a href="/"><img class="header__logo-image" src="/cdn/shop/files/kelp-logo.png" srcset="/cdn/shop/files/kelp-logo.png 200w, /cdn/shop/files/kelp-logo@2x.png 400w" alt="Kelp &amp; Cotton"></a>
    <nav>
      <a href="/collections/knitwear">Knitwear</a>
      <a href="/collections/home">Home</a>
      <a href="/pages/about">Our workshop</a>
      <a href="/products/oat-crew">Oat Crew</a>
      <a href="https://www.instagram.com/kelpandcotton">Instagram</a>
      <a href="https://www.tiktok.com/@kelpandcotton">TikTok</a>
    </nav>
  </header>
  <main>
    <h1>Slow basics for a warm house</h1>
    <h2>Knitted in Porto, in runs of fifty</h2>
    <p>We make a small number of things and we make them properly. Wool from a mill in Yorkshire, cotton grown without pesticides, and a workshop of nine people in Porto.</p>
    <p>Everything is designed to be mended rather than replaced. We will repair anything we have made, for as long as we are here.</p>
    <button class="cart__button">Add to basket</button>
  </main>
  <script src="https://cdn.judge.me/widget.js"></script>
</body>
</html>`;

/** `/products.json` — decimal price strings, image objects, `available`. */
export const PRODUCTS_JSON = JSON.stringify({
  products: [
    {
      id: 7001,
      title: "Oat Crew",
      handle: "oat-crew",
      body_html: "<p>A boxy wool crew in undyed oat.</p><p>Knitted in Porto.</p>",
      published_at: "2026-02-01T09:00:00+00:00",
      created_at: "2026-01-20T09:00:00+00:00",
      vendor: "Kelp & Cotton",
      product_type: "Knitwear",
      tags: ["wool", "unisex", "bestseller"],
      variants: [
        { id: 41001, title: "S", option1: "S", sku: "OC-S", available: true, price: "148.00", compare_at_price: "185.00", position: 1 },
        { id: 41002, title: "M", option1: "M", sku: "OC-M", available: false, price: "148.00", compare_at_price: null, position: 2 },
      ],
      images: [
        { id: 9001, position: 2, src: "https://cdn.shopify.com/s/files/1/0001/oat-crew-2.jpg", width: 1600, height: 2000 },
        { id: 9002, position: 1, src: "https://cdn.shopify.com/s/files/1/0001/oat-crew-1.jpg", width: 1600, height: 2000 },
      ],
      options: [{ name: "Size", position: 1, values: ["S", "M"] }],
    },
    {
      id: 7002,
      title: "Linen Tea Towel",
      handle: "linen-tea-towel",
      body_html: "<p>Heavy linen, stonewashed.</p>",
      published_at: "2026-03-11T09:00:00+00:00",
      vendor: "Kelp & Cotton",
      product_type: "Home",
      tags: ["linen", "home"],
      variants: [{ id: 41010, title: "Default Title", option1: "Default Title", available: false, price: "18.50", compare_at_price: null }],
      images: [{ id: 9010, position: 1, src: "https://cdn.shopify.com/s/files/1/0001/tea-towel.jpg", width: 1200, height: 1200 }],
      options: [{ name: "Title", position: 1, values: ["Default Title"] }],
    },
  ],
});

/** `/products/<handle>.js` — minor units, bare image URLs, `description`. */
export const PRODUCT_JS = JSON.stringify({
  id: 7003,
  title: "Wool Throw",
  handle: "wool-throw",
  description: "<p>A heavy throw in undyed wool.</p>",
  type: "Home",
  vendor: "Kelp & Cotton",
  tags: ["wool", "home"],
  price: 21500,
  available: true,
  featured_image: "//cdn.shopify.com/s/files/1/0001/throw-1.jpg",
  images: ["//cdn.shopify.com/s/files/1/0001/throw-1.jpg", "//cdn.shopify.com/s/files/1/0001/throw-2.jpg"],
  variants: [
    { id: 41020, title: "Default Title", options: ["Default Title"], available: true, price: 21500, compare_at_price: null },
  ],
});

export const ROBOTS_TXT = `User-agent: *
Disallow: /checkout
Disallow: /cart
Disallow: /account
Disallow: /*preview_theme_id*
Sitemap: https://kelpandcotton.com/sitemap.xml
`;
