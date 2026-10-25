"use client";

import { sendEvent } from "@/components/beacon";
import { buttonClass, type Variant } from "@/components/ui/button";

// A link to the next step that records which one was chosen and from which
// page (names only, never anything a visitor typed). Gumroad opens in the same
// tab: new tabs are clumsy in Instagram's in-app browser, where most visits
// start.

export function OfferLink({
  href,
  offer,
  source = "calculator",
  variant = "primary",
  children,
}: {
  href: string;
  offer: string;
  source?: string;
  variant?: Variant;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={buttonClass(variant)}
      onClick={() => sendEvent("offer_clicked", { source, path: offer })}
    >
      {children}
      {external ? <span className="sr-only"> (on Gumroad)</span> : null}
    </a>
  );
}
