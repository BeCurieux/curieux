import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HeightReporter } from "@/components/widget/HeightReporter";
import { PausedNotice } from "@/components/widget/PausedNotice";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { appUrl } from "@/config/brand";
import { getStore } from "@/lib/db/store";
import { publicDocument, renderableFor } from "@/lib/widgets/service";

export const dynamic = "force-dynamic";

// Framed by other people's sites, so it must never be indexed on its own.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The frameable widget (brief §21).
 *
 * Deliberately nothing but the widget: no header, no footer, no page
 * background of its own. It should look like part of whatever site it lands
 * on, which means the host page's whitespace shows through.
 */
export default async function EmbedPage({ params }: { params: { slug: string } }) {
  const record = await getStore().getWidgetBySlug(params.slug);
  if (!record) notFound();

  const document = publicDocument(record);
  if (!document) notFound();

  const { widget, showBadge, overInteractionLimit } = await renderableFor(record, document);

  if (overInteractionLimit) {
    return (
      <div className="bg-transparent p-1">
        <HeightReporter />
        <PausedNotice name={widget.name} />
      </div>
    );
  }

  return (
    <div className="bg-transparent p-1">
      <HeightReporter />
      <WidgetRenderer
        widget={widget}
        live
        showBadge={showBadge}
        badgeHref={`${appUrl()}/?from=badge&w=${record.slug}`}
      />
    </div>
  );
}
