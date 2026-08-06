// The installable app, which exists for exactly one feature.
//
// Not because a childhood archive needs to be an app — it does not — but
// because installing is what puts Qotidia in a phone's share sheet. That is
// the difference between "open the app, find the child, tap add, choose the
// photo" and "share → Qotidia", and it is the whole of what makes capture
// something a tired parent still does in March.
//
// Worth being straight about the limit: `share_target` is implemented by
// Chromium browsers on Android and by nothing on iOS, where the share sheet
// is closed to web apps. Half the audience therefore cannot have this door,
// which is why the address in lib/inbox/address.ts exists — mail works on
// every phone ever made, and does not require installing anything.

import type { MetadataRoute } from "next";
import { BRAND, TAGLINE, WORDMARK } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND,
    short_name: WORDMARK,
    description: TAGLINE,
    start_url: "/home",
    display: "standalone",
    background_color: "#F2E9DC",
    theme_color: "#F2E9DC",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],

    // Not part of Next's Manifest type yet, hence the cast. Declared as a
    // POST with multipart encoding because the payload can be photographs;
    // a GET share target would put a camera roll into a query string.
    ...({
      share_target: {
        action: "/api/inbox/share",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          title: "title",
          text: "text",
          url: "url",
          files: [
            {
              name: "files",
              // Deliberately not image/* — the scan job reads the bytes and
              // decides what a file really is, and a share sheet's idea of a
              // MIME type is a claim like any other.
              accept: ["image/*", "video/*", "audio/*"],
            },
          ],
        },
      },
    } as Record<string, unknown>),
  };
}
