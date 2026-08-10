import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { DuplicateButton } from "@/components/widget/DuplicateButton";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { Logo } from "@/components/site/Chrome";
import { appUrl, brand } from "@/config/brand";
import { getStore } from "@/lib/db/store";
import { publicDocument, renderableFor } from "@/lib/widgets/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const record = await getStore().getWidgetBySlug(params.slug);
  const document = record ? publicDocument(record) : null;
  if (!document) return { title: "Not found" };

  return {
    title: document.name,
    description: document.intro?.description ?? document.result.heading,
    openGraph: { title: document.name, url: `${appUrl()}/w/${params.slug}` },
  };
}

/**
 * The hosted page (brief §21).
 *
 * "Visually beautiful enough to use independently" — so it's a real page, not
 * a bare iframe with a URL. Someone with no website at all can put this link
 * in an Instagram bio and have a working quote tool.
 */
export default async function HostedWidgetPage({ params }: { params: { slug: string } }) {
  const record = await getStore().getWidgetBySlug(params.slug);
  if (!record) notFound();

  const document = publicDocument(record);
  if (!document) notFound();

  const { widget, showBadge } = await renderableFor(record, document);

  return (
    <div className="min-h-screen bg-lavender">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        {widget.theme.logoUrl ? (
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={widget.theme.logoUrl} alt="" className="h-9 w-auto object-contain" />
          </div>
        ) : null}

        <WidgetRenderer
          widget={widget}
          live
          showBadge={showBadge}
          badgeHref={`${appUrl()}/?from=badge&w=${record.slug}`}
        />

        {/* §22: the growth loop, on the page rather than only in the badge. */}
        {showBadge ? (
          <div className="mx-auto mt-10 max-w-md rounded-card border border-rule bg-white p-5 text-center">
            <Logo size={26} />
            <p className="mt-3 text-sm font-bold text-navy">Like this widget?</p>
            <p className="mt-1 text-sm leading-relaxed text-slate">
              Make your own in about two minutes — or start from this exact one.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/?from=badge" className="btn">
                Make my own
              </Link>
              <DuplicateButton widgetId={record.id} />
            </div>
          </div>
        ) : (
          <p className="mt-10 text-center text-xs text-muted">
            <Link href="/" className="hover:text-purple">
              {brand.name}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
