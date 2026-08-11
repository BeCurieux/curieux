// The homepage (brief §9, §10, §42).
//
// Two jobs, in this order: show the product working, then let someone start.
// So the hero is mostly a real, interactive widget rather than a screenshot of
// one, and the thing directly beneath it is the prompt box — the most
// important interaction on the page.

import Link from "next/link";
import type { Metadata } from "next";
import { PromptBox } from "@/components/create/PromptBox";
import { Illustration } from "@/components/illustrations/Illustration";
import { HeroArt, HeroLeaves } from "@/components/site/HeroArt";
import { SiteFooter, SiteHeader, Sparkles, Squiggle } from "@/components/site/Chrome";
import { ArrowRightIcon, ChartIcon, LinkIcon, SparkleIcon } from "@/components/ui/Icons";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { HERO_TEMPLATE_SLUG, TEMPLATES, templateBySlug } from "@/lib/templates/catalogue";
import { widgetSchema } from "@/lib/widget/schema";

export const metadata: Metadata = {
  description: brand.heroSupport,
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const user = await currentUser();
  const heroTemplate = templateBySlug(HERO_TEMPLATE_SLUG)!;

  // The hero widget is the real runtime, with analytics and the badge off: it
  // isn't published, so it has nothing to record and nothing to advertise.
  // The welcome screen is dropped so it opens on an actual question — a hero
  // that shows a "Get started" button is showing the least interesting frame.
  const demo = widgetSchema.parse({
    ...heroTemplate.document,
    id: "hero-demo",
    slug: heroTemplate.slug,
    status: "published",
    intro: undefined,
    settings: { ...heroTemplate.document.settings, leadCapture: { mode: "none", fields: ["email"] } },
  });

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      {/* §22: someone arrived by clicking a badge on somebody else's widget. */}
      {searchParams.from === "badge" ? (
        <div className="border-b border-purple-mid bg-purple-soft">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-5 py-3 text-sm">
            <strong className="font-bold text-purple">Like that widget?</strong>
            <span className="text-slate">You can make your own in about two minutes.</span>
            <Link href="#build" className="btn-soft py-2">
              Make one <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      ) : null}

      <main>
        {/* ---- Hero ------------------------------------------------ */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-yellow-soft blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-purple-soft blur-3xl" />

          <div className="relative mx-auto grid max-w-[1240px] gap-12 px-5 pb-12 pt-14 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-center lg:gap-10 lg:pb-14 lg:pt-20">
            <div>
              <span className="badge">
                <SparkleIcon size={13} />
                Playful smart
              </span>

              <h1 className="mt-5 text-display">
                {brand.heroHeadline.lead}
                <br />
                <span className="relative inline-block text-purple">
                  {brand.heroHeadline.accent}
                  <Squiggle className="absolute -bottom-3 left-0 h-4 w-full text-mint" />
                </span>
              </h1>

              <p className="mt-7 max-w-md text-lg leading-relaxed text-slate">{brand.heroSupport}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="#build" className="btn btn-lg">
                  Start building for free
                  <ArrowRightIcon size={18} />
                </Link>
                <Link href="/templates" className="btn-secondary btn-lg">
                  View templates
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
                {brand.heroProofPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm font-medium text-slate">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-mint-soft text-mint">
                      ✓
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <HeroArt className="mt-10 hidden h-auto w-full max-w-md lg:block" />
            </div>

            <div>
              {/* The decoration is anchored to the card, not the column, so it
                  tucks into the corner rather than drifting under the caption. */}
              <div className="relative">
                <Sparkles className="absolute -left-8 -top-6 hidden h-14 w-14 text-yellow lg:block" />
                <WidgetRenderer widget={demo} live={false} showBadge={false} />
                <HeroLeaves className="pointer-events-none absolute -bottom-8 -right-10 hidden h-32 w-40 lg:block" />
              </div>
              <p className="mt-4 text-center text-xs font-medium text-muted">
                This one is real — try it.
              </p>
            </div>
          </div>
        </section>

        {/* ---- The prompt box (§10) -------------------------------- */}
        <section id="build" className="scroll-mt-20 px-5 pb-16 pt-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-title">What do you want your website to do?</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate">
              Describe it in your own words. We&rsquo;ll build the questions, the maths and the result
              screen — you edit anything you don&rsquo;t like.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            <PromptBox variant="hero" />
          </div>

          <p className="mx-auto mt-5 max-w-md text-center text-xs leading-relaxed text-muted">
            No account needed to build one. We only ask who you are when you publish.
          </p>
        </section>

        {/* ---- Three promises -------------------------------------- */}
        <section className="px-5 py-10">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
            <PromiseCard
              tone="purple"
              icon={<SparkleIcon size={20} />}
              title="Build in minutes"
              body="Describe it or start from a template. Everything is editable, nothing needs code."
            />
            <PromiseCard
              tone="mint"
              icon={<LinkIcon size={20} />}
              title="Share anywhere"
              body="A hosted link, an iframe or a one-line script. It resizes itself to fit your page."
            />
            <PromiseCard
              tone="yellow"
              icon={<ChartIcon size={20} />}
              title="See what happens"
              body="Views, starts, completions and clicks. Enough to know what's working."
            />
          </div>
        </section>

        {/* ---- How it works ---------------------------------------- */}
        <section className="px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="panel overflow-hidden px-6 py-12 sm:px-12">
              <div className="max-w-lg">
                <p className="eyebrow">How it works</p>
                <h2 className="mt-3 text-title">Four steps, and none of them are “learn our editor”.</h2>
              </div>

              <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { n: 1, t: "Describe it", b: "One sentence about what you want to ask and what it costs." },
                  { n: 2, t: "Make it yours", b: "Change any question, price or colour. Watch it update live." },
                  { n: 3, t: "Publish", b: "A hosted page, or paste one line into your site." },
                  { n: 4, t: "Watch it work", b: "Completions, clicks and — on Pro — the enquiries it brings in." },
                ].map((step) => (
                  <li key={step.n} className="rounded-card border border-rule bg-white p-5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-purple text-sm font-bold text-white">
                      {step.n}
                    </span>
                    <p className="mt-3 font-bold">{step.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate">{step.b}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---- Templates ------------------------------------------- */}
        <section className="px-5 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-md">
                <p className="eyebrow">Made for any idea you have</p>
                <h2 className="mt-3 text-title">From real estate to fitness.</h2>
                <p className="mt-3 text-slate">
                  If you can calculate it, you can build it here. Every template below is a working
                  widget, not a picture of one.
                </p>
              </div>
              <Link href="/templates" className="btn-secondary">
                All templates
                <ArrowRightIcon size={16} />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATES.slice(0, 4).map((template) => (
                <Link
                  key={template.slug}
                  href={`/templates/${template.slug}`}
                  className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <Illustration name={template.illustration} size={52} />
                  <p className="mt-4 font-bold leading-tight">{template.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {template.type}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{template.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Closing ---------------------------------------------- */}
        <section className="px-5 py-16">
          <div className="mx-auto max-w-3xl rounded-hero border border-rule bg-navy px-6 py-14 text-center text-white sm:px-12">
            {/* Not "Build once. Use anywhere." — the footer strip says that
                two hundred pixels further down. */}
            <h2 className="text-title text-white">Ready to make one?</h2>
            <p className="mx-auto mt-4 max-w-sm text-white/70">
              Free to build and free to publish. We only ask who you are when you press publish.
            </p>
            <Link
              href="#build"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-btn bg-white px-6 py-4 text-base font-semibold text-navy transition hover:bg-lavender"
            >
              Start building for free
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function PromiseCard({
  tone,
  icon,
  title,
  body,
}: {
  tone: "purple" | "mint" | "yellow";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const tones = {
    purple: "bg-purple-soft text-purple",
    mint: "bg-mint-soft text-mint",
    yellow: "bg-yellow-soft text-yellow",
  } as const;

  return (
    <div className="card p-6">
      <span className={`grid h-12 w-12 place-items-center rounded-full ${tones[tone]}`}>{icon}</span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate">{body}</p>
    </div>
  );
}
