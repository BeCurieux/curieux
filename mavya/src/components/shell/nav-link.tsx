"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// A link that knows whether it is the current section. The section root
// (e.g. /family) only matches exactly; deeper links match their subtree.
function useIsActive(href: string, exact: boolean, also: readonly string[]) {
  const pathname = usePathname();
  if (also.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  href,
  exact = false,
  also = [],
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  also?: readonly string[];
  className: string;
  children: ReactNode;
}) {
  const active = useIsActive(href, exact, also);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
