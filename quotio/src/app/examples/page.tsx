import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { UseTemplateButton } from "@/components/templates/UseTemplateButton";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { templateBySlug } from "@/lib/templates/catalogue";
import { widgetSchema } from "@/lib/widget/schema";
import type { Answers } from "@/lib/widget/engine";

export const metadata: Metadata = {
  title: "Examples",
  description: "Three widgets doing a real job, in the kind of page they'd normally live on.",
};

/**
 * Examples (brief §43).
 *
 * The template gallery answers "what could I build?". This page answers "what
 * does one look like on my site?" — so each widget sits in a different kind of
 * pretend page, at the width it would really have there. A landing page, a
 * shop page and a pricing page are not the same shape, and three identical
 * mocks with the words swapped would prove nothing.
 *
 * The widgets are shown as a paying customer's would be: no badge, and
 * partway through a conversation rather than frozen on an unanswered first
 * question.
 */
interface Example {
  slug: string;
  site: string;
  nav: string[];
  context: string;
  heading: string;
  body: string;
  layout: "landing" | "shop" | "pricing";
  /** Where the demo picks up, so nothing is greyed out on arrival. */
  start?: { stepId?: string; answers?: Answers };
}

const SHOWCASE: Example[] = [
  {
    slug: "cleaning-estimate",
    site: "sparkle & co.",
    nav: ["Services", "Areas", "Prices", "About"],
    context: "On a cleaning company's home page, under the hero.",
    heading: "Cleaning that fits around your week",
    body: "Vetted cleaners, fixed prices and no awkward phone calls. See what your place would cost before you commit to anything.",
    layout: "landing",
    // Both the step behind and the one on screen, so the rail shows a tick
    // and Continue is live rather than greyed.
    start: { stepId: "bedrooms", answers: { home_type: 60, bedrooms: 2 } },
  },
  {
    slug: "skincare-finder",
    site: "north & fern",
    nav: ["Shop", "Routines", "Journal", "Help"],
    context: "On a skincare brand's shop page, in the column where the filters would be.",
    heading: "Not sure where to start?",
    body: "Nine products, one right answer. Three questions and we'll tell you which set your skin actually wants.",
    layout: "shop",
    start: { answers: { skin_type: "dry" } },
  },
  {
    slug: "roi-calculator",
    site: "meridian",
    nav: ["Product", "Customers", "Pricing", "Docs"],
    context: "Halfway down a B2B pricing page, above the plan table.",
    heading: "Would this pay for itself?",
    body: "Put your own numbers in. We'd rather you talked yourself into it than took our word for anything.",
    layout: "pricing",
  },
];

export default async function ExamplesPage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-10">
        <div className="max-w-xl">
          <p className="eyebrow">Examples</p>
          <h1 className="mt-2 text-title">In the wild.</h1>
          <p className="mt-3 leading-relaxed text-slate">
            Three widgets, doing a job, on three different kinds of page. All of them work — go on.
          </p>
        </div>

        <div className="mt-12 space-y-16">
          {SHOWCASE.map((example) => {
            const template = templateBySlug(example.slug);
            if (!template) return null;

            const widget = widgetSchema.parse({
              ...template.document,
              id: `example-${template.slug}`,
              slug: template.slug,
              status: "published",
              intro: undefined,
              settings: {
                ...template.document.settings,
                leadCapture: { ...template.document.settings.leadCapture, mode: "none" },
              },
            });

            // No badge: these are pretend Pro customers' sites, and a real one
            // wouldn't carry our name.
            const demo = (
              <WidgetRenderer
                widget={widget}
                live={false}
                showBadge={false}
                initialStepId={example.start?.stepId}
                initialAnswers={example.start?.answers}
              />
            );

            return (
              <section key={example.slug}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {example.context}
                </p>

                <BrowserFrame site={example.site} nav={example.nav}>
                  {example.layout === "landing" ? (
                    <LandingMock heading={example.heading} body={example.body}>
                      {demo}
                    </LandingMock>
                  ) : example.layout === "shop" ? (
                    <ShopMock heading={example.heading} body={example.body}>
                      {demo}
                    </ShopMock>
                  ) : (
                    <PricingMock heading={example.heading} body={example.body}>
                      {demo}
                    </PricingMock>
                  )}
                </BrowserFrame>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <UseTemplateButton
                    slug={example.slug}
                    label={`Start from ${template.name}`}
                    tone="secondary"
                  />
                  <Link href={`/templates/${template.slug}`} className="btn-ghost">
                    See how it&rsquo;s built
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The pretend websites                                                */
/* ------------------------------------------------------------------ */

/** Chrome plus a site header, so the frame reads as a page and not a box. */
function BrowserFrame({
  site,
  nav,
  children,
}: {
  site: string;
  nav: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-panel border border-rule bg-white shadow-lift">
      <div className="flex items-center gap-2 border-b border-rule bg-lavender/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-coral" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint" />
        <span className="ml-3 flex-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted">
          {site}.com
        </span>
      </div>

      {/* The pretend site's own header. */}
      <div className="flex items-center gap-4 border-b border-rule px-6 py-3.5">
        <span className="text-sm font-bold lowercase tracking-tight text-navy">{site}</span>
        <nav className="ml-auto hidden items-center gap-5 sm:flex" aria-hidden="true">
          {nav.map((item) => (
            <span key={item} className="text-xs font-medium text-slate">
              {item}
            </span>
          ))}
          <span className="rounded-full bg-navy px-3 py-1.5 text-[11px] font-semibold text-white">
            Get in touch
          </span>
        </nav>
      </div>

      {children}
    </div>
  );
}

/** A landing page: centred hero copy, widget directly beneath it. */
function LandingMock({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10 sm:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-title">{heading}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate">{body}</p>
      </div>
      <div className="mx-auto mt-8 max-w-3xl">{children}</div>
    </div>
  );
}

/**
 * A shop page: the widget sits in the narrow column where filters would be,
 * next to a grid of products — which is also the honest way to show that a
 * widget rearranges itself when it isn't given the full width (§36).
 */
function ShopMock({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-8 sm:px-8">
      <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
      <p className="mt-2 max-w-md text-sm text-slate">{body}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div>{children}</div>

        <div aria-hidden="true">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {["#E7F7F3", "#FFEFCF", "#FFE0E6", "#DDDEFC", "#E7F7F3", "#FFEFCF"].map(
              (tone, index) => (
                <div key={index}>
                  <div className="aspect-square rounded-card" style={{ background: tone }} />
                  <div className="mt-2 h-2 w-3/4 rounded-full bg-rule" />
                  <div className="mt-1.5 h-2 w-1/3 rounded-full bg-rule" />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A pricing page: the widget sits above the plan table it argues for. */
function PricingMock({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10 sm:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-title">{heading}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate">{body}</p>
      </div>

      <div className="mx-auto mt-8 max-w-3xl">{children}</div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3" aria-hidden="true">
        {["Starter", "Growth", "Scale"].map((tier, index) => (
          <div
            key={tier}
            className={`rounded-card border p-4 ${
              index === 1 ? "border-navy bg-lavender/50" : "border-rule"
            }`}
          >
            <p className="text-xs font-bold text-navy">{tier}</p>
            <div className="mt-3 h-5 w-16 rounded-full bg-rule" />
            <div className="mt-4 space-y-2">
              <div className="h-2 w-full rounded-full bg-rule" />
              <div className="h-2 w-4/5 rounded-full bg-rule" />
              <div className="h-2 w-2/3 rounded-full bg-rule" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
