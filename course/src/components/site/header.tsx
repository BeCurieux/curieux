import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-line border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4"
      >
        <Link href="/" className="text-accent font-serif text-xl font-extrabold no-underline">
          Her Little Empire
        </Link>
        <span className="flex gap-5 font-semibold">
          <Link href="/pricing">Pricing</Link>
          <Link href="/hype">Hype Check</Link>
          <Link href="/learn">Sign in</Link>
        </span>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-line mt-16 border-t">
      <div className="text-mute mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-5 py-8 text-base">
        <span>© Her Little Empire</span>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/refunds">Refunds</Link>
        <Link href="/waitlist">Waitlist</Link>
      </div>
    </footer>
  );
}

export function DraftNotice({ draft }: { draft: boolean }) {
  if (!draft) return null;
  return (
    <aside
      aria-label="Draft notice"
      className="mx-auto max-w-3xl px-5 pt-4"
      data-testid="draft-notice"
    >
      <span className="bg-danger-soft text-danger inline-block rounded-full px-3 py-1 text-sm font-semibold">
        Draft copy: the final wording replaces this before launch.
      </span>
    </aside>
  );
}
