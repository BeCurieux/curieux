"use client";

import { sendEvent } from "@/components/beacon";
import { buttonClass, type Variant } from "@/components/ui/button";

// A link to the next step that records which one was chosen (the offer's
// name only, never anything typed into the calculator).

export function OfferLink({
  href,
  offer,
  variant = "primary",
  children,
}: {
  href: string;
  offer: string;
  variant?: Variant;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={buttonClass(variant)}
      onClick={() => sendEvent("offer_clicked", { source: "calculator", path: offer })}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
      {external ? <span className="sr-only"> (opens Gumroad in a new tab)</span> : null}
    </a>
  );
}
