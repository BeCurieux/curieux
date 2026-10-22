import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Wordmark />
      <nav aria-label="Site" className="flex items-center gap-1 sm:gap-4">
        <Link href="/pricing" className="text-ink hover:text-oxblood px-2 py-2 text-sm font-medium">
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
              className="text-ink hover:text-oxblood px-2 py-2 text-sm font-medium"
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
      <div className="text-ink-soft mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          <span className="text-oxblood font-serif text-base">Her Little Empire</span> — Big plans.
          Real life.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-4">
          <Link href="/pricing" className="hover:text-oxblood">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-oxblood">
            Terms and refunds
          </Link>
          <Link href="/privacy" className="hover:text-oxblood">
            Privacy
          </Link>
          <a href="https://herlittleempire.com" className="hover:text-oxblood">
            herlittleempire.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
