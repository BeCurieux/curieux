"use client";

// A widget on the dashboard (brief §28).
//
//   Cleaning Estimate
//   Published · 1,423 views · 67% completion
//   [Edit] [...]

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartIcon, CopyIcon, EyeIcon, TrashIcon } from "@/components/ui/Icons";
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
}

export function WidgetCard(props: WidgetCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = async (action: () => Promise<{ ok: boolean; widgetId?: string; error?: string }>) => {
    setBusy(true);
    const result = await action();
    setOpen(false);
    setBusy(false);
    if (result.widgetId) router.push(`/dashboard/widgets/${result.widgetId}`);
    else router.refresh();
  };

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/widgets/${props.id}`}
            className="block truncate font-bold text-navy hover:text-purple"
          >
            {props.name}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                props.status === "published" ? "bg-mint-soft text-mint" : "bg-lavender text-muted"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {props.status === "published" ? "Published" : "Draft"}
            </span>
            <span className="capitalize">{props.type}</span>
          </p>
        </div>

        <div className="relative flex-none">
          <button
            type="button"
            className="btn-ghost px-2"
            aria-label={`More options for ${props.name}`}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            ⋯
          </button>

          {open ? (
            <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-card border border-rule bg-white py-1 shadow-lift">
              {props.status === "published" ? (
                <a
                  href={props.hostedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate hover:bg-lavender"
                >
                  <EyeIcon size={15} /> View live page
                </a>
              ) : null}

              <Link
                href={`/dashboard/widgets/${props.id}/analytics`}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate hover:bg-lavender"
              >
                <ChartIcon size={15} /> Analytics
              </Link>

              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => duplicateWidget(props.id))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate hover:bg-lavender"
              >
                <CopyIcon size={15} /> Duplicate
              </button>

              {props.status === "published" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => unpublishWidget(props.id))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate hover:bg-lavender"
                >
                  Unpublish
                </button>
              ) : null}

              {/* Deleting takes analytics and leads with it, so it asks. */}
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

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-rule pt-4">
        <Stat label="Views" value={props.analyticsAllowed ? props.stats.views.toLocaleString() : "—"} />
        <Stat
          label="Completion"
          value={
            props.analyticsAllowed
              ? props.stats.starts > 0
                ? `${props.stats.completionRate}%`
                : "—"
              : "Pro"
          }
        />
      </dl>

      <div className="mt-4 flex gap-2">
        <Link href={`/dashboard/widgets/${props.id}`} className="btn flex-1">
          Edit
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-navy">{value}</dd>
    </div>
  );
}
