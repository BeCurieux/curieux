"use client";

import { sendEvent } from "@/components/beacon";
import { buttonClass, type Variant } from "@/components/ui/button";

// A link to the next step that records which one was chosen and from which
// page (names only, never anything a visitor typed).

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
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
      {external ? <span className="sr-only"> (opens Gumroad in a new tab)</span> : null}
    </a>
  );
}
