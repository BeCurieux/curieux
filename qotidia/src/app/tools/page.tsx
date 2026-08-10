// The free tools.
//
// One page, and it leads with what the tools do not do rather than with what
// they do — because "free tool" is a phrase people have learned to distrust,
// and the interesting claim here is the absence of the usual machinery.

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { NEVER, publishedTools } from "@/lib/tools/list";

export const metadata = {
  title: `Free tools — ${BRAND}`,
  description:
    "Small useful things that need no account and upload nothing. Your browser does the work and we never see the files.",
};

export default function ToolsPage() {
  const tools = publishedTools();

  return (
    <div className="mx-auto !max-w-2xl py-16">
      <h1 className="text-display font-display lowercase">free tools</h1>
      <p className="mt-7 max-w-[44ch] text-lede text-stone">
        Useful whether or not you ever buy anything. No account, and your
        photographs never leave your device.
      </p>

      <ul className="mt-16 space-y-10">
        {tools.map((t) => (
          <li key={t.slug}>
            <p className="text-sm text-clay">{t.question}</p>
            <h2 className="mt-2 font-display text-2xl leading-snug">
              <Link
                href={`/tools/${t.slug}`}
                className="underline decoration-transparent underline-offset-4 transition hover:decoration-ink"
              >
                {t.title}
              </Link>
            </h2>
            <p className="reading mt-2.5 max-w-[54ch] leading-relaxed text-stone">
              {t.description}
            </p>
          </li>
        ))}
        {tools.length === 0 && <li className="text-stone">Nothing here yet.</li>}
      </ul>

      {/* The absence of the usual machinery, stated plainly. Each of these is
          checked by tests/tools.test.ts rather than merely intended. */}
      <section className="mt-20 border-t border-rule pt-10">
        <h2 className="font-display text-xl">What these never do</h2>
        <ul className="mt-4 space-y-2 text-sm text-stone">
          {NEVER.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/journal" className="text-ochre">The journal</Link>
        {" · "}
        <Link href="/privacy" className="text-ochre">How we keep your family private</Link>
      </p>
    </div>
  );
}
