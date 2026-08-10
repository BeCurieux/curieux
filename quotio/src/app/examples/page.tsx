import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { UseTemplateButton } from "@/components/templates/UseTemplateButton";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { templateBySlug } from "@/lib/templates/catalogue";
import { widgetSchema } from "@/lib/widget/schema";

export const metadata: Metadata = {
  title: "Examples",
  description: "Three widgets doing a real job, in the kind of page they'd normally live on.",
};

/**
 * Examples (brief §43).
 *
 * The template gallery answers "what could I build?". This page answers
 * "what does one look like on my site?" — so each widget sits inside a
 * pretend page, at the width it would really have, with the theme its owner
 * would really have chosen.
 */
const SHOWCASE = [
  {
    slug: "cleaning-estimate",
    site: "sparkle & co.",
    context: "On a cleaning company's home page, under the hero.",
    heading: "Cleaning that fits around your week",
    body: "Vetted cleaners, fixed prices and no awkward phone calls. See what your place would cost before you commit to anything.",
  },
  {
    slug: "skincare-finder",
    site: "north & fern",
    context: "On a skincare brand's shop page, instead of a filter menu.",
    heading: "Not sure where to start?",
    body: "Nine products, one right answer. Three questions and we'll tell you which set your skin actually wants.",
  },
  {
    slug: "roi-calculator",
    site: "meridian",
    context: "Halfway down a B2B pricing page, before the plan table.",
    heading: "Would this pay for itself?",
    body: "Put your own numbers in. We'd rather you talked yourself into it than took our word for anything.",
  },
];

export default async function ExamplesPage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-5xl px-5 py-14">
        <div className="max-w-xl">
          <p className="eyebrow">Examples</p>
          <h1 className="mt-3 text-display">In the wild.</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            Three widgets, doing a job, on the kind of page they&rsquo;d normally live on. All of
            them work — go on.
          </p>
        </div>

        <div className="mt-14 space-y-16">
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

            return (
              <section key={example.slug}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {example.context}
                </p>

                {/* A browser chrome frame, so the widget reads as "on a site". */}
                <div className="mt-3 overflow-hidden rounded-panel border border-rule bg-white shadow-lift">
                  <div className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-coral" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-mint" />
                    <span className="ml-3 rounded-full bg-lavender px-3 py-1 text-[11px] font-medium text-muted">
                      {example.site}
                    </span>
                  </div>

                  <div className="px-5 py-10 sm:px-10">
                    <div className="mx-auto max-w-2xl text-center">
                      <h2 className="text-title">{example.heading}</h2>
                      <p className="mx-auto mt-3 max-w-md text-slate">{example.body}</p>
                    </div>

                    <div className="mx-auto mt-8 max-w-2xl">
                      <WidgetRenderer widget={widget} live={false} showBadge />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <UseTemplateButton slug={example.slug} label={`Start from ${template.name}`} />
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
