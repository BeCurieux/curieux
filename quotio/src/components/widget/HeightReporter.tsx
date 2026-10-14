"use client";

// Tells the parent page how tall the widget is (brief §21).
//
// The embed's whole trick: a ResizeObserver on the document, posting the
// height up to embed.js, which sets the iframe. Without it an embedded widget
// either clips its result screen or reserves a fixed lump of empty space —
// both of which look broken on someone else's site.

import { useEffect } from "react";

export function HeightReporter() {
  useEffect(() => {
    if (window.parent === window) return;

    let last = 0;
    const post = () => {
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      // Ignore sub-pixel churn; a 2px threshold stops a resize feedback loop.
      if (Math.abs(height - last) < 2) return;
      last = height;
      window.parent.postMessage({ type: "mekmi:height", height }, "*");
    };

    post();
    const observer = new ResizeObserver(post);
    observer.observe(document.documentElement);

    // Screen transitions animate, so the final height arrives after the paint.
    const timers = [120, 400, 900].map((delay) => setTimeout(post, delay));
    window.addEventListener("load", post);

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      window.removeEventListener("load", post);
    };
  }, []);

  return null;
}
