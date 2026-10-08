/** Shapes copied from what Shopify and Etsy actually return, trimmed to the
 *  fields we read plus a few we deliberately do not. */

export const SHOPIFY_JSON = {
  product: {
    id: 1,
    title: "Ceramic Bud Vase | Speckled Stoneware",
    vendor: "Fern &amp; Kiln",
    body_html:
      "<p>A small vase for a single stem.</p><ul><li>Wheel-thrown stoneware</li><li>Speckled oatmeal glaze</li><li>Stands 12 cm tall</li></ul><p><strong>Shipping</strong></p><p>Ships in 3&ndash;5 days.</p>",
    variants: [
      { id: 11, price: "28.00", available: false },
      { id: 12, price: "32.00", available: true },
    ],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/vase-front.jpg?v=1" },
      { src: "//cdn.shopify.com/s/files/1/vase-side.jpg?v=1" },
      { src: "https://cdn.shopify.com/s/files/1/vase-front.jpg?v=1" },
    ],
  },
};

export const SHOPIFY_PAGE = `<!doctype html><html><head>
<title>Ceramic Bud Vase – Fern & Kiln</title>
<meta property="og:title" content="Ceramic Bud Vase">
<meta property="og:price:amount" content="32.00">
<meta property="og:price:currency" content="GBP">
<meta property="og:site_name" content="Fern &amp; Kiln">
</head><body>…</body></html>`;

export const LD_PAGE = `<!doctype html><html><head>
<script type="application/ld+json">{ broken json </script>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"BreadcrumbList","itemListElement":[]},
  {"@type":"Product","name":"Linen Apron &amp; Pocket",
   "description":"<p>Heavy linen apron.</p><p>Two deep pockets</p>",
   "image":[{"@type":"ImageObject","url":"/img/apron.jpg"},"https://cdn.example.com/apron-2.jpg"],
   "brand":{"@type":"Brand","name":"Thread Room"},
   "offers":{"@type":"AggregateOffer","lowPrice":"45","priceCurrency":"usd"}}
]}
</script>
<meta property="og:description" content="Heavy linen apron with two deep pockets, cross-back straps and a loop for a towel.">
</head></html>`;

export const ETSY_LISTING = {
  listing_id: 123456789,
  title: "Personalised Name Necklace | Gold Name Necklace | Gift for Her",
  description: "Dainty name necklace.\n\n• 14k gold filled chain\n• Up to 10 letters\n• Gift box included",
  price: { amount: 3450, divisor: 100, currency_code: "EUR" },
};

export const ETSY_IMAGES = {
  count: 2,
  results: [
    { rank: 2, url_fullxfull: "https://i.etsystatic.com/2/il_fullxfull.2.jpg" },
    { rank: 1, url_fullxfull: "https://i.etsystatic.com/1/il_fullxfull.1.jpg" },
  ],
};
