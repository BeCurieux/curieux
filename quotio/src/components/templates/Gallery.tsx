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
  /**
   * A real question from the template, for the card's miniature (§24).
   * Taken from the document rather than written by hand, so a card can never
   * advertise something the template doesn't actually ask.
   */
  preview: {
    question: string;
    options: Array<{ id: string; label: string; illustration?: IllustrationKey }>;
  };
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
            <div
              className="relative border-b border-rule px-3.5 pb-3.5 pt-9"
              style={{ background: `${card.brandColour}1F` }}
            >
              <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate">
                {card.type}
              </span>
              <MiniWidget card={card} />
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

/**
 * A scale model of the widget: its real first question, its real first three
 * answers, its progress bar.
 *
 * §24 asks for a miniature preview on each card, and the honest way to build
 * one is out of the template itself — a hand-drawn mock could drift from what
 * the template actually does. Decorative here (`aria-hidden`): the card's
 * heading below carries the name for assistive tech.
 */
function MiniWidget({ card }: { card: GalleryCard }) {
  const { question, options } = card.preview;

  return (
    <div
      className="rounded-[10px] border border-white/70 bg-white p-2.5 shadow-soft"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-1 w-6 rounded-full" style={{ background: card.brandColour }} />
        <span className="h-1 flex-1 rounded-full bg-rule" />
      </div>

      <p className="mt-2 truncate text-[10px] font-bold leading-tight text-navy">{question}</p>

      {options.length > 0 ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {options.map((option, index) => (
            <span
              key={option.id}
              className="flex h-[46px] flex-col items-center justify-center gap-0.5 rounded-[7px] border px-0.5"
              style={
                index === 0
                  ? { borderColor: card.brandColour, background: `${card.brandColour}14` }
                  : { borderColor: "#E7EAF6", background: "#FFFFFF" }
              }
            >
              <span className="w-full truncate text-center text-[8px] font-bold leading-none text-navy">
                {option.label}
              </span>
              {option.illustration ? (
                <Illustration name={option.illustration} size={22} />
              ) : (
                <span className="h-[22px]" />
              )}
            </span>
          ))}
        </div>
      ) : (
        // Sliders and number fields have no answer cards to show.
        <div className="mt-1.5 flex h-[46px] flex-col justify-center gap-1.5 rounded-[7px] border border-rule px-2">
          <span className="h-1.5 rounded-full bg-rule">
            <span
              className="block h-1.5 w-2/5 rounded-full"
              style={{ background: card.brandColour }}
            />
          </span>
          <span className="h-1 w-8 rounded-full bg-rule" />
        </div>
      )}
    </div>
  );
}
