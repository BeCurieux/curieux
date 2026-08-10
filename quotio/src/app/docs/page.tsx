import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { appUrl, brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { ALLOWED_FUNCTIONS } from "@/lib/widget/expression";

export const metadata: Metadata = {
  title: "Docs",
  description: "How to embed a widget, and how the formulas work.",
};

/**
 * Docs.
 *
 * Two things people genuinely get stuck on — putting the widget on their site,
 * and writing a formula — and nothing else. A documentation site is not the
 * product (§2).
 */
export default async function DocsPage() {
  const user = await currentUser();
  const origin = appUrl();

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="eyebrow">Docs</p>
        <h1 className="mt-3 text-display">The short version.</h1>

        <nav className="mt-8 flex flex-wrap gap-2">
          {[
            ["#embedding", "Embedding"],
            ["#formulas", "Formulas"],
            ["#rules", "Rules"],
            ["#analytics", "Analytics"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="pill">
              {label}
            </a>
          ))}
        </nav>

        <section id="embedding" className="scroll-mt-20 pt-14">
          <h2 className="text-title">Putting a widget on your site</h2>
          <p className="mt-4 leading-relaxed text-slate">
            Publish the widget, then pick one of three. All three are on the Publish screen with a
            copy button — this page is just here to explain the difference.
          </p>

          <h3 className="mt-8 font-bold">1. A link</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            Every published widget gets a hosted page that&rsquo;s good enough to use on its own —
            in an email, a bio link or a QR code.
          </p>
          <Code>{`${origin}/w/your-widget`}</Code>

          <h3 className="mt-8 font-bold">2. A script (recommended)</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            The widget tells your page how tall to be as people move through it, so it never gets
            its own scrollbar or leaves a gap underneath.
          </p>
          <Code>{`<script src="${origin}/embed.js" async></script>\n<div data-widget="your-widget"></div>`}</Code>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            You can put several <code className="font-mono">data-widget</code> divs on one page. Add{" "}
            <code className="font-mono">data-height=&quot;700&quot;</code> to set the height it uses
            before the widget has loaded.
          </p>

          <h3 className="mt-8 font-bold">3. A plain iframe</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            For site builders that won&rsquo;t let you add a script. It works, but it can&rsquo;t
            resize itself, so pick a height that fits your longest question.
          </p>
          <Code>{`<iframe src="${origin}/embed/your-widget"\n  style="width:100%;border:0;height:620px"\n  title="Your widget" loading="lazy"></iframe>`}</Code>
        </section>

        <section id="formulas" className="scroll-mt-20 pt-14">
          <h2 className="text-title">Formulas</h2>
          <p className="mt-4 leading-relaxed text-slate">
            A formula is arithmetic over your questions. Each question has a short name — you can
            see it under the question in the Content tab — and you use those names directly.
          </p>

          <Code>{`bedrooms * 35 + bathrooms * 25 + oven * 30`}</Code>

          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate">
            <li>
              <strong className="text-navy">Pick-an-answer questions</strong> are worth whatever you
              set in the &ldquo;Worth&rdquo; box next to each answer.
            </li>
            <li>
              <strong className="text-navy">Yes/no questions</strong> are 1 when on and 0 when off,
              so an add-on is <code className="font-mono text-xs">oven * 30</code>.
            </li>
            <li>
              <strong className="text-navy">Multiple-choice questions</strong> add up everything
              ticked, so <code className="font-mono text-xs">extras</code> on its own is the total of
              the extras chosen.
            </li>
            <li>
              <strong className="text-navy">total</strong> is whatever your rules have added so far.
              Include it if you use rules, or they won&rsquo;t affect the price.
            </li>
          </ul>

          <p className="mt-6 text-sm leading-relaxed text-slate">
            You can use <code className="font-mono text-xs">+ − * / %</code>, brackets, and{" "}
            {ALLOWED_FUNCTIONS.map((fn, index) => (
              <span key={fn}>
                <code className="font-mono text-xs">{fn}()</code>
                {index < ALLOWED_FUNCTIONS.length - 1 ? ", " : ""}
              </span>
            ))}
            . That&rsquo;s the whole language — there&rsquo;s no code in a widget, which is also why
            nothing you or we write can ever run on your visitors&rsquo; machines.
          </p>

          <div className="card mt-6 p-5">
            <p className="text-sm font-bold">Why a breakdown sometimes doesn&rsquo;t appear</p>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              The &ldquo;See breakdown&rdquo; button only shows when the lines add up to the total
              exactly. Formulas that multiply two answers together (say{" "}
              <code className="font-mono text-xs">guests * catering</code>) can&rsquo;t be split into
              honest per-question lines, so we show no breakdown rather than a wrong one.
            </p>
          </div>
        </section>

        <section id="rules" className="scroll-mt-20 pt-14">
          <h2 className="text-title">Rules</h2>
          <p className="mt-4 leading-relaxed text-slate">
            Rules react to an answer. They read as sentences in the Logic tab, and run top to bottom.
          </p>
          <div className="panel mt-5 p-5 font-mono text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-purple">If</p>
            <p className="mt-1">Bedrooms · is at least · 4</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-purple">Then</p>
            <p className="mt-1">Add to the total · 40</p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate">
            Rules can also give points to a quiz result, reveal or hide a later question, or add a
            line of explanation to the result screen.
          </p>
        </section>

        <section id="analytics" className="scroll-mt-20 pt-14">
          <h2 className="text-title">What we count</h2>
          <p className="mt-4 leading-relaxed text-slate">
            Seven events: a view, a start, each question completed, a finish, the result being seen,
            a click on your button, and an enquiry. Each carries the widget, an anonymous per-tab id
            and a timestamp.
          </p>
          <p className="mt-4 leading-relaxed text-slate">
            No cookies, no cross-site tracking, no IP logging, no third-party pixels. The per-tab id
            lives in <code className="font-mono text-xs">sessionStorage</code> and disappears when
            the tab closes — it exists so we can tell one person answering five questions from five
            people answering one.
          </p>
        </section>

        <div className="mt-16 rounded-panel border border-rule bg-lavender p-6 text-center">
          <p className="font-bold">Stuck on something that isn&rsquo;t here?</p>
          <p className="mt-1.5 text-sm text-slate">
            <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-purple">
              {brand.supportEmail}
            </a>{" "}
            — a person reads it.
          </p>
          <Link href="/dashboard/widgets/new" className="btn mt-5">
            Build a widget
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-card border border-rule bg-navy px-4 py-3.5 font-mono text-xs leading-relaxed text-white">
      {children}
    </pre>
  );
}
