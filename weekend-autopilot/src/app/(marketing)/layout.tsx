import Link from "next/link";
import { BrandLogo, ButtonLink } from "@/components/ui";
import { brand } from "@/config/brand";
import { flags } from "@/config/flags";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b border-rule/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <BrandLogo />
          <nav className="flex items-center gap-5">
            <Link
              href="/example"
              className="hidden text-[15px] text-graphite hover:text-ink sm:block"
            >
              Example
            </Link>
            <Link
              href="/pricing"
              className="hidden text-[15px] text-graphite hover:text-ink sm:block"
            >
              Pricing
            </Link>
            <Link href="/login" className="text-[15px] text-graphite hover:text-ink">
              Log in
            </Link>
            {flags().offerPilot ? (
              <ButtonLink href="/pricing" size="sm">
                Get started
              </ButtonLink>
            ) : null}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-rule">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <BrandLogo href={null} />
              <p className="mt-3 text-[15px] leading-relaxed text-mist">{brand.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-x-10 gap-y-3 text-[15px] text-graphite">
              <Link href="/example" className="hover:text-ink">
                Example weekend
              </Link>
              <Link href="/pricing" className="hover:text-ink">
                Pricing
              </Link>
              <Link href="/faq" className="hover:text-ink">
                FAQ
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
              <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink">
                Contact
              </a>
            </nav>
          </div>
          <p className="mt-10 text-[13px] text-mist">
            Currently planning weekends in Sydney. Elsewhere soon.
          </p>
        </div>
      </footer>
    </div>
  );
}
