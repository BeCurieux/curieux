/**
 * A storefront with bad photography, on purpose.
 *
 * The renderer's job, in the brief's words, is to "flatter mediocre product
 * photography". A fixture full of clean square studio shots would let every
 * regression through, because the plate only has to do work when the pictures
 * disagree with each other — so these deliberately do. Seven kinds of wrong:
 * landscape when the grid wants portrait, a white cut-out that floats with no
 * ground, underexposed, extremely wide, a busy phone snap, blown highlights,
 * and a 200px thumbnail. One product has no photograph at all.
 *
 * It serves the surfaces the ingester actually reads — `/`, `/products.json`,
 * `/robots.txt` — so a shop under test is built by the real pipeline rather
 * than hand-written into the shape the assertions expect.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

interface Photo {
  w: number;
  h: number;
  bg: string;
  obj: string;
  note: string;
}

const PHOTOS: Record<string, Photo> = {
  "1": { w: 1600, h: 1200, bg: "#e8e3da", obj: "#8d7f6d", note: "decent studio, landscape" },
  "2": { w: 1200, h: 1200, bg: "#ffffff", obj: "#c9c2b6", note: "white cut-out that floats" },
  "3": { w: 900, h: 1200, bg: "#1c1a17", obj: "#3b352d", note: "underexposed" },
  "4": { w: 2000, h: 900, bg: "#d9d2c7", obj: "#6f6455", note: "very wide, crops hard" },
  "5": { w: 1080, h: 1080, bg: "#b9a98f", obj: "#7a6a52", note: "phone snap, busy surface" },
  "6": { w: 800, h: 1200, bg: "#fbf9f5", obj: "#ded6c8", note: "blown highlights" },
  "8": { w: 200, h: 200, bg: "#efeae1", obj: "#a89c88", note: "tiny, low resolution" },
};

function photo(id: string): string {
  const p = PHOTOS[id]!;
  // The cut-out sits off-centre so a centred crop cannot rescue it.
  const cx = id === "2" ? p.w * 0.34 : p.w / 2;
  const busy = id === "5" ? `<rect width="${p.w}" height="${p.h}" fill="url(#weave)"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}">
<defs>
<pattern id="weave" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="${p.bg}"/><path d="M0 13h26M13 0v26" stroke="#00000012" stroke-width="6"/></pattern>
<radialGradient id="g" cx="45%" cy="38%"><stop offset="0" stop-color="#ffffff" stop-opacity="${id === "6" ? 0.9 : 0.34}"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/></radialGradient>
<filter id="soft"><feGaussianBlur stdDeviation="${Math.max(2, p.w / 220)}"/></filter>
</defs>
<rect width="${p.w}" height="${p.h}" fill="${p.bg}"/>${busy}
<ellipse cx="${cx}" cy="${p.h * 0.58}" rx="${p.w * 0.3}" ry="${p.h * 0.1}" fill="#00000018" filter="url(#soft)"/>
<rect x="${cx - p.w * 0.2}" y="${p.h * 0.2}" width="${p.w * 0.4}" height="${p.h * 0.44}" rx="${p.w * 0.05}" fill="${p.obj}"/>
<rect width="${p.w}" height="${p.h}" fill="url(#g)"/>
</svg>`;
}

/**
 * handle, title, type, price, available, image ids, description.
 *
 * Two are sold out and one has an empty image list, because both are states
 * the page has to render rather than skip.
 */
const PRODUCTS = [
  ["oat-crew", "Oat Crew", "Knitwear", "148.00", true, ["1", "4"], "A boxy wool crew in undyed oat. Knitted in Porto in runs of fifty."],
  ["linen-tea-towel", "Linen Tea Towel", "Home", "18.50", false, ["2"], "Heavy linen, stonewashed until it stops being stiff."],
  ["wool-throw", "Wool Throw", "Home", "215.00", true, ["3"], "A heavy throw in undyed wool. Big enough for two."],
  ["sage-cardigan", "Sage Cardigan", "Knitwear", "168.00", true, ["5", "1"], "Lambswool, dropped shoulder, horn buttons."],
  ["cotton-tee", "Everyday Tee", "Basics", "42.00", true, ["6"], "Organic cotton, cut long. The one you reach for."],
  ["wool-socks", "Ribbed Socks", "Basics", "22.00", true, ["8"], "Thick rib in the same wool as the crew."],
  ["care-card", "Care Card", "Home", "4.00", true, [], "How to wash wool without ruining it."],
  ["porto-mug", "Porto Mug", "Home", "26.00", false, ["2", "5"], "Thrown by the studio next door to ours."],
] as const;

/** The two the ledger of assertions cares about by name. */
export const SOLD_OUT_HANDLES: string[] = PRODUCTS.filter(([, , , , available]) => !available).map(
  ([handle]) => handle,
);
export const PRODUCT_COUNT = PRODUCTS.length;

function productsJson(origin: string): string {
  return JSON.stringify({
    products: PRODUCTS.map(([handle, title, type, price, available, imgs, body], i) => ({
      id: 7000 + i,
      title,
      handle,
      body_html: `<p>${body}</p>`,
      product_type: type,
      vendor: "Kelp & Cotton",
      tags: [type.toLowerCase(), i < 3 ? "bestseller" : "new"],
      variants: [
        {
          id: 41000 + i,
          title: "Default Title",
          available,
          price,
          compare_at_price: handle === "cotton-tee" ? "58.00" : null,
        },
      ],
      images: imgs.map((n, k) => ({
        id: 9000 + i * 10 + k,
        position: k + 1,
        src: `${origin}/img/${n}.svg`,
        width: PHOTOS[n]!.w,
        height: PHOTOS[n]!.h,
      })),
    })),
  });
}

function home(origin: string): string {
  return `<!doctype html><html lang="en-GB"><head>
<title>Kelp &amp; Cotton | Slow basics for a warm house</title>
<meta name="description" content="Slow basics for a warm house. Made in small runs in Porto, in wool and organic cotton.">
<meta property="og:site_name" content="Kelp &amp; Cotton">
<meta name="theme-color" content="#2f5d50">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Kelp & Cotton","logo":{"@type":"ImageObject","url":"${origin}/img/2.svg"}}</script>
<script>var Shopify=Shopify||{};Shopify.currency={"active":"GBP","rate":"1.0"};</script>
<style>:root{--color-background:250 248 244;--color-text:#22201d;--color-accent:#2f5d50;--color-surface:#f0ebe1;--color-border:#ded7ca}</style>
</head><body><header><nav>
<a href="/collections/knitwear">Knitwear</a><a href="/collections/home">Home</a><a href="/pages/about">Our workshop</a><a href="/pages/repairs">Repairs</a>
<a href="https://www.instagram.com/kelpandcotton">Instagram</a></nav></header>
<main><h1>Slow basics for a warm house</h1><h2>Knitted in Porto, in runs of fifty</h2>
<p>We make a small number of things and we make them properly. Wool from a mill in Yorkshire, cotton grown without pesticides, and a workshop of nine people in Porto.</p>
<p>Everything is designed to be mended rather than replaced. We will repair anything we have made, for as long as we are here.</p>
<button>Add to basket</button></main></body></html>`;
}

export interface FixtureStore {
  url: string;
  close: () => Promise<void>;
}

/** Port 0 so a stray copy of this server from an earlier run cannot collide. */
export async function startFixtureStore(): Promise<FixtureStore> {
  const server = http.createServer((req, res) => {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const pathname = (req.url ?? "/").split("?")[0]!;

    const img = /^\/img\/(\w+)\.svg$/.exec(pathname);
    if (img && PHOTOS[img[1]!]) {
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public,max-age=60" }).end(photo(img[1]!));
      return;
    }

    if (pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(home(origin));
      return;
    }

    if (pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /cart\n");
      return;
    }

    if (pathname === "/products.json") {
      const page = Number(new URL(req.url!, origin).searchParams.get("page") ?? "1");
      res.writeHead(200, { "content-type": "application/json" }).end(page === 1 ? productsJson(origin) : '{"products":[]}');
      return;
    }

    res.writeHead(404).end("no");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
