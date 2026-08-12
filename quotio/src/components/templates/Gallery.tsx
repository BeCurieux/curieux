"use client";

// The template gallery (brief §24).

import { useState } from "react";
import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { TEMPLATE_FILTERS, type TemplateFilter } from "@/lib/templates/catalogue";
import { MiniWidget, MiniWidgetFrame, type MiniWidgetData } from "@/components/widget/MiniWidget";
import type { IllustrationKey } from "@/lib/widget/illustrations";

export interface GalleryCard {
  slug: string;
  name: string;
  type: string;
  tagline: string;
  audience: string;
  illustration: IllustrationKey;
  questionCount: number;
  brandColour: string;
  /** A real question from the template, for the card's miniature (§24). */
  preview: MiniWidgetData;
}

export function Gallery({ cards }: { cards: GalleryCard[] }) {
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const visible = filter === "all" ? cards : cards.filter((card) => card.type === filter);

  return (
    <>
      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
        {TEMPLATE_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === option.id
                ? "border-purple bg-purple text-white"
                : "border-rule bg-white text-slate hover:border-purple-mid hover:text-purple"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((card) => (
          <Link
            key={card.slug}
            href={`/templates/${card.slug}`}
            className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <MiniWidgetFrame
              brandColour={card.brandColour}
              badge={
                <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate">
                  {card.type}
                </span>
              }
            >
              <MiniWidget data={card.preview} />
            </MiniWidgetFrame>

            <div className="flex flex-1 flex-col p-5">
              <p className="font-bold leading-tight">{card.name}</p>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate">{card.tagline}</p>
              <p className="mt-3 text-xs text-muted">{card.questionCount} questions</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple">
                Use template
                <ArrowRightIcon size={15} className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">Nothing in that category yet.</p>
      ) : null}
    </>
  );
}
