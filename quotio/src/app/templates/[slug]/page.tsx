import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UseTemplateButton } from "@/components/templates/UseTemplateButton";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/Icons";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { TEMPLATES, templateBySlug } from "@/lib/templates/catalogue";
import { widgetSchema } from "@/lib/widget/schema";

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const template = templateBySlug(params.slug);
  if (!template) return { title: "Template not found" };
  return { title: template.name, description: template.tagline };
}

/**
 * A template, previewed (brief §24).
 *
 * "Clicking a template should open a working preview first." So the widget on
 * this page is the widget — fully interactive, with analytics and lead capture
 * off because nobody has adopted it yet.
 */
export default async function TemplatePage({ params }: { params: { slug: string } }) {
  const template = templateBySlug(params.slug);
  if (!template) notFound();

  const user = await currentUser();

  const preview = widgetSchema.parse({
    ...template.document,
    id: `template-${template.slug}`,
    slug: template.slug,
    status: "published",
    settings: {
      ...template.document.settings,
      leadCapture: { ...template.document.settings.leadCapture, mode: "none" },
    },
  });

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <Link href="/templates" className="btn-ghost -ml-2">
          <ArrowLeftIcon size={16} />
          All templates
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <Illustration name={template.illustration} size={72} />
            <p className="eyebrow mt-4 capitalize">{template.type}</p>
            <h1 className="mt-2 text-title">{template.name}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate">{template.tagline}</p>

            <p className="mt-6 text-sm font-semibold text-navy">Built for</p>
            <p className="mt-1 text-sm text-slate">{template.audience}</p>

            <ul className="mt-6 space-y-2">
              {[
                `${template.document.steps.length} questions`,
                template.document.result.kind === "recommendation"
                  ? `${template.document.result.outcomes.length} possible recommendations`
                  : "A calculated result with a breakdown",
                template.document.logic.length > 0
                  ? `${template.document.logic.length} rule${template.document.logic.length === 1 ? "" : "s"} you can edit`
                  : "No rules to unpick — the formula does the work",
                "Every word, price and colour is yours to change",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-slate">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-mint-soft text-mint">
                    <CheckIcon size={12} strokeWidth={3} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <UseTemplateButton slug={template.slug} />
              <p className="mt-3 text-xs text-muted">
                No account needed. We only ask when you publish.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Try it — this is the real thing
            </p>
            <WidgetRenderer widget={preview} live={false} showBadge={false} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
