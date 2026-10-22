"use client";

import { useEffect, useState } from "react";

// Analytics consent. Declining is as easy as accepting, and the site works
// the same either way. Accepting only lets us link one visitor's page views
// together with a random id; nothing goes to advertisers (docs/ANALYTICS.md).

const CONSENT = "empire_consent";
const ANON = "empire_anon";

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax; Secure`;
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Reading a browser-only cookie after mount; the banner never renders on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!readCookie(CONSENT));
  }, []);
  if (!open) return null;

  const choose = (yes: boolean) => {
    setCookie(CONSENT, yes ? "yes" : "no");
    if (yes && !readCookie(ANON)) setCookie(ANON, crypto.randomUUID());
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie choice"
      className="no-print border-line bg-paper fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <p className="text-ink text-sm">
        We use one first-party cookie to understand which parts of Empire Studio help people (no ad
        trackers, ever). Sign-in cookies are always on because the studio needs them.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => choose(true)}
          className="bg-oxblood text-ivory min-h-11 rounded-full px-4 text-sm font-semibold"
        >
          That's fine
        </button>
        <button
          onClick={() => choose(false)}
          className="border-oxblood text-oxblood min-h-11 rounded-full border px-4 text-sm font-semibold"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
