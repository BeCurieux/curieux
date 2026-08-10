// The JavaScript embed (brief §21).
//
//   <script src="https://…/embed.js" async></script>
//   <div data-widget="acme-cleaning"></div>
//
// It builds an iframe, and the iframe tells it how tall to be — so a widget
// grows and shrinks as someone moves through the questions instead of sitting
// in a fixed box with its own scrollbar.
//
// Served as a route rather than a static file so the origin baked into it is
// always the deployment's own, which means a copied snippet works whether it
// came from localhost, a preview deploy or production.

import { appUrl } from "@/config/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const script = `(function () {
  "use strict";

  var ORIGIN = ${JSON.stringify(appUrl())};
  var ATTRIBUTE = "data-widget";
  var mounted = [];

  function mount(host) {
    if (host.getAttribute("data-quotio-mounted") === "true") return;
    var slug = host.getAttribute(ATTRIBUTE);
    if (!slug) return;
    host.setAttribute("data-quotio-mounted", "true");

    var frame = document.createElement("iframe");
    frame.src = ORIGIN + "/embed/" + encodeURIComponent(slug);
    frame.title = host.getAttribute("data-title") || "Interactive widget";
    frame.loading = "lazy";
    frame.style.width = "100%";
    frame.style.border = "0";
    frame.style.display = "block";
    frame.style.overflow = "hidden";
    frame.style.colorScheme = "normal";
    // A sensible first paint before the iframe reports its real height.
    frame.style.height = (host.getAttribute("data-height") || "560") + "px";
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("allow", "clipboard-write");

    host.appendChild(frame);
    mounted.push({ slug: slug, frame: frame });
  }

  function scan() {
    var hosts = document.querySelectorAll("[" + ATTRIBUTE + "]");
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data;
    if (!data || data.type !== "quotio:height") return;

    for (var i = 0; i < mounted.length; i++) {
      // Match on the source window, not the slug: the same widget can be
      // embedded twice on one page and they resize independently.
      if (mounted[i].frame.contentWindow === event.source) {
        var height = Math.max(200, Math.min(4000, Number(data.height) || 0));
        if (height) mounted[i].frame.style.height = height + "px";
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Widgets dropped in later by a page builder or a SPA route change.
  if (typeof MutationObserver === "function") {
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
