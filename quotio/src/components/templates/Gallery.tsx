"use client";

// The template gallery (brief §24).

import { useState } from "react";
import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { TEMPLATE_FILTERS, type TemplateFilter } from "@/lib/templates/catalogue";
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <Link
            key={card.slug}
            href={`/templates/${card.slug}`}
            className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            {/* A miniature of the widget itself, in the template's own colour. */}
            <div
              className="relative flex h-36 items-center justify-center border-b border-rule"
              style={{ background: `${card.brandColour}12` }}
            >
              <Illustration name={card.illustration} size={68} />
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate">
                {card.type}
              </span>
              <MiniPreview colour={card.brandColour} steps={card.questionCount} />
            </div>

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

/** Three little bars standing in for the widget's steps. */
function MiniPreview({ colour, steps }: { colour: string; steps: number }) {
  return (
    <span className="absolute bottom-3 left-3 flex gap-1" aria-hidden="true">
      {Array.from({ length: Math.min(5, steps) }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 w-5 rounded-full"
          style={{ background: index === 0 ? colour : `${colour}40` }}
        />
      ))}
    </span>
  );
}
