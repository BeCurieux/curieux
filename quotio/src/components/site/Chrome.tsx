// Marketing site chrome (brief §9).
//
// "Keep header very clean." One row, six items, one filled button. The logo is
// drawn rather than typeset so the wordmark keeps its personality when the
// product is eventually renamed — the mark stays, the word comes from
// config/brand.ts.

import Link from "next/link";
import { brand } from "@/config/brand";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="#5B5FEF" />
        <circle cx="15" cy="17" r="3" fill="#FFFFFF" />
        <circle cx="25" cy="17" r="3" fill="#FFFFFF" />
        <path
          d="M14 25c1.8 2.2 4 3.3 6 3.3S24.2 27.2 26 25"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="32" cy="9" r="4" fill="#FFC857" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-navy">{brand.name}</span>
    </span>
  );
}

const NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" aria-label={`${brand.name} home`}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="btn-ghost">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="btn">
              Your widgets
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">
                Sign in
              </Link>
              <Link href="/signup" className="btn">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule bg-lavender">
      {/* The two promises, side by side, as in the reference. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-rule px-5 py-6">
        <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 20S3 14.5 3 9a4.5 4.5 0 0 1 9-1.5A4.5 4.5 0 0 1 21 9c0 5.5-9 11-9 11Z"
              fill="#5B5FEF"
            />
          </svg>
          Delightful for your audience. Powerful for your business.
        </p>
        <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
          <Squiggle className="h-3 w-12 text-mint" />
          Build once. Use anywhere.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-slate">{brand.tagline}</p>
          </div>

          <div className="flex flex-wrap gap-x-14 gap-y-8 text-sm">
            <FooterColumn
              title="Product"
              links={[
                { href: "/templates", label: "Templates" },
                { href: "/examples", label: "Examples" },
                { href: "/pricing", label: "Pricing" },
              ]}
            />
            <FooterColumn
              title="Start"
              links={[
                { href: "/dashboard/widgets/new", label: "New widget" },
                { href: "/signup", label: "Create an account" },
                { href: "/login", label: "Sign in" },
              ]}
            />
            <FooterColumn
              title="More"
              links={[
                { href: "/docs", label: "Docs" },
                { href: `mailto:${brand.supportEmail}`, label: "Contact" },
              ]}
            />
          </div>
        </div>

        <p className="mt-10 text-xs text-muted">
          © {new Date().getFullYear()} {brand.name}. Name subject to change.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-slate transition hover:text-purple">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The little hand-drawn marks from the reference (§42). */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 30" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 20c14-16 26 10 40-4s24 12 38-2 26 6 38-6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Sparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <path d="M14 4c1.4 7 3.6 9.2 10.6 10.6C17.6 16 15.4 18.2 14 25c-1.4-6.8-3.6-9-10.6-10.4C10.4 13.2 12.6 11 14 4Z" fill="currentColor" />
      <path d="M44 26c1 5 2.6 6.6 7.6 7.6-5 1-6.6 2.6-7.6 7.6-1-5-2.6-6.6-7.6-7.6 5-1 6.6-2.6 7.6-7.6Z" fill="currentColor" opacity="0.7" />
      <circle cx="30" cy="50" r="3.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
