"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Module pages live under /m/<module>; light up the studio they belong to.
const MODULE_TABS: Record<string, string> = {
  theme_brief: "/theme",
  theme_prompts: "/theme",
  homepage_copy: "/theme",
  email_sequence: "/marketing",
  social_content: "/marketing",
};

function owns(href: string, pathname: string, base: string) {
  const moduleKey = pathname.match(/\/m\/([a-z_]+)/)?.[1];
  if (moduleKey && `${base}${MODULE_TABS[moduleKey] ?? ""}` === href) return true;
  return pathname.startsWith(`${base}/profile`) && href === `${base}/brand`;
}

export function StudioNav({ profileId, brandName }: { profileId: string; brandName: string }) {
  const pathname = usePathname();
  const base = `/studio/${profileId}`;
  const items = [
    ["Overview", base],
    ["Brand", `${base}/brand`],
    ["Store design", `${base}/theme`],
    ["Products", `${base}/products`],
    ["Photos", `${base}/mockups`],
    ["Marketing", `${base}/marketing`],
    ["Launch checklist", `${base}/launch`],
    ["Saved assets", `${base}/assets`],
  ] as const;
  return (
    <div className="no-print border-line bg-ivory border-b">
      <div className="mx-auto max-w-6xl px-5 pt-4 sm:px-8">
        <p className="eyebrow truncate">{brandName}</p>
        <nav aria-label="Studio" className="-mx-5 mt-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 pb-3">
            {items.map(([label, href]) => {
              const active =
                href === base
                  ? pathname === base
                  : pathname.startsWith(href) || owns(href, pathname, base);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ${
                      active ? "bg-aubergine text-ivory" : "text-charcoal hover:bg-blush-soft"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
