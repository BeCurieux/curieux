import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Imprint } from "./imprint";
import { PROMISE, TAGLINE } from "@/content/brand";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Wordmark />
      <nav aria-label="Site" className="flex items-center gap-1 sm:gap-4">
        <Link
          href="/pricing"
          className="text-charcoal hover:text-aubergine px-2 py-2 text-sm font-medium"
        >
          Pricing
        </Link>
        {user ? (
          <ButtonLink href="/studio" variant="primary">
            Open studio
          </ButtonLink>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="text-charcoal hover:text-aubergine px-2 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
            <ButtonLink href="/sign-in?start=1" className="hidden sm:inline-flex">
              Start free
            </ButtonLink>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-line mt-24 border-t">
      <div className="text-mute mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p>
            <span className="text-aubergine font-serif text-base">Her Little Empire</span> —{" "}
            {PROMISE}
          </p>
          <p className="mt-1">{TAGLINE}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link href="/fit" className="hover:text-aubergine">
            Free FIT Finder
          </Link>
          <Link href="/ads/tools/calculator" className="hover:text-aubergine">
            Free ads calculator
          </Link>
          <Link href="/pricing" className="hover:text-aubergine">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-aubergine">
            Terms and refunds
          </Link>
          <Link href="/privacy" className="hover:text-aubergine">
            Privacy
          </Link>
          <a href="https://herlittleempire.com" className="hover:text-aubergine">
            herlittleempire.com
          </a>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <Imprint />
      </div>
    </footer>
  );
}
