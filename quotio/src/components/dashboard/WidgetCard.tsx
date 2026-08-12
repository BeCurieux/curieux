"use client";

// A widget on the dashboard (brief §28).
//
// Shows the widget rather than describing it: the same miniature the template
// gallery uses, so your own work is at least as recognisable as somebody
// else's template. Edit, Analytics and View live are all visible — hiding a
// page behind a hover-only "⋯" makes it, in practice, not exist. The menu
// keeps what you press rarely and regret often.

import { useState } from "react";
import Link from "next/link";
import { ChartIcon, CopyIcon, EyeIcon, TrashIcon } from "@/components/ui/Icons";
import { MiniWidget, MiniWidgetFrame, type MiniWidgetData } from "@/components/widget/MiniWidget";
import { deleteWidget, duplicateWidget, unpublishWidget } from "@/app/actions";
import type { WidgetStats } from "@/lib/analytics/events";

export interface WidgetCardProps {
  id: string;
  name: string;
  type: string;
  slug: string;
  status: "draft" | "published";
  updatedAt: string;
  stats: WidgetStats;
  hostedUrl: string;
  analyticsAllowed: boolean;
  preview: MiniWidgetData;
}

export function WidgetCard(props: WidgetCardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const published = props.status === "published";

  const run = async (action: () => Promise<{ ok: boolean; widgetId?: string; error?: string }>) => {
    setBusy(true);
    const result = await action();
    setOpen(false);
    setBusy(false);
    if (result.widgetId) window.location.href = `/dashboard/widgets/${result.widgetId}`;
    else window.location.reload();
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <MiniWidgetFrame
        brandColour={props.preview.brandColour}
        badge={
          <span
            className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              published ? "bg-mint text-white" : "bg-white/90 text-muted"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {published ? "Live" : "Draft"}
          </span>
        }
      >
        <MiniWidget data={props.preview} />
      </MiniWidgetFrame>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/dashboard/widgets/${props.id}`}
              className="block truncate font-bold text-navy hover:text-purple"
            >
              {props.name}
            </Link>
            <p className="mt-0.5 text-xs capitalize text-muted">{props.type}</p>
          </div>

          <div className="relative flex-none">
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              aria-label={`More options for ${props.name}`}
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              ⋯
            </button>

            {open ? (
              <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-card border border-rule bg-white py-1 shadow-lift">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => duplicateWidget(props.id))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate hover:bg-lavender"
                >
                  <CopyIcon size={15} /> Duplicate
                </button>

                {published ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => unpublishWidget(props.id))}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate hover:bg-lavender"
                  >
                    Unpublish
                  </button>
                ) : null}

                {/* Deleting takes analytics and enquiries with it, so it asks. */}
                {confirming ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => deleteWidget(props.id))}
                    className="flex w-full items-center gap-2 bg-coral-soft px-3 py-2 text-left text-sm font-semibold text-coral"
                  >
                    <TrashIcon size={15} /> Really delete it?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-coral hover:bg-coral-soft"
                  >
                    <TrashIcon size={15} /> Delete
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-rule pt-3">
          <Stat label="Views" value={props.analyticsAllowed ? format(props.stats.views) : "—"} />
          {/* "Finished 62%" beside "Views 316" invites reading it as 62% of
              those views. It is 62% of *starts* — someone who scrolled past
              never had the chance to finish — so the card says which, the way
              the analytics tile does. */}
          <Stat
            label="Finished"
            value={
              props.analyticsAllowed
                ? props.stats.starts > 0
                  ? `${props.stats.completionRate}%`
                  : "—"
                : "Pro"
            }
            caption={
              props.analyticsAllowed && props.stats.starts > 0 ? "of starts" : undefined
            }
          />
          {/* Enquiries are what a business is actually here for. */}
          <Stat
            label="Enquiries"
            value={props.analyticsAllowed ? format(props.stats.leads) : "Pro"}
            highlight={props.stats.leads > 0}
          />
        </dl>

        <div className="mt-4 flex items-center gap-1.5">
          <Link href={`/dashboard/widgets/${props.id}`} className="btn flex-1 py-2.5">
            Edit
          </Link>
          <Link
            href={`/dashboard/widgets/${props.id}/analytics`}
            className="btn-secondary px-2.5 py-2.5"
            aria-label={`Analytics for ${props.name}`}
            title="Analytics"
          >
            <ChartIcon size={16} />
          </Link>
          {published ? (
            <a
              href={props.hostedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-2.5 py-2.5"
              aria-label={`View ${props.name} live`}
              title="View live"
            >
              <EyeIcon size={16} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function format(value: number): string {
  return value.toLocaleString();
}

function Stat({
  label,
  value,
  caption,
  highlight,
}: {
  label: string;
  value: string;
  caption?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? "text-purple" : "text-navy"}`}
      >
        {value}
      </dd>
      {/* A fixed slot, so the three columns keep their baselines whether or
          not a stat has something to qualify. */}
      <p className="min-h-[0.875rem] text-[10px] leading-[0.875rem] text-muted">{caption ?? ""}</p>
    </div>
  );
}
