/**
 * The plan timeline.
 *
 * Designed to work with nothing but typography, rules and one accent (§54): no
 * photograph is required, and none is used, because licensed venue imagery is
 * a complication we do not need and generic stock would cheapen the thing.
 *
 * What makes it read well is the tabular time column and the hairline between
 * stops — it looks like an itinerary someone wrote out for you, which is
 * exactly the feeling the product is selling.
 */

import type { PlanItem } from "@/lib/types";
import { displayTime } from "@/lib/util/time";
import { formatMoneyRange, type Market } from "@/config/markets";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<string, string> = {
  TRAVEL: "Travel",
  WALK: "Walk",
  VENUE: "Visit",
  FOOD: "Eat",
  ACTIVITY: "Do",
  BREAK: "Break",
  OPTIONAL: "Optional",
};

export function TimelineItem({
  item,
  market,
  isLast,
}: {
  item: PlanItem;
  market: Market;
  isLast: boolean;
}) {
  const isTravel = item.item_type === "TRAVEL";
  const cost = Number(item.estimated_cost_max);
  const showCost = cost > 0;

  return (
    <li className={cn("flex gap-4 py-4", !isLast && "border-b border-rule")}>
      <div className="w-[52px] shrink-0 pt-0.5">
        <span className="tabular text-[15px] text-mist">{displayTime(item.start_time)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={cn(
              "font-sans text-[16px] leading-snug",
              isTravel ? "text-graphite" : "font-semibold text-ink"
            )}
          >
            {item.title}
          </h3>
          {showCost ? (
            <span className="tabular shrink-0 text-[13px] text-mist">
              {formatMoneyRange(market, Number(item.estimated_cost_min), cost)}
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="mt-1 text-[15px] leading-relaxed text-graphite">{item.description}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mist">
          <span>{TYPE_LABEL[item.item_type] ?? item.item_type}</span>

          {item.walk_distance_km ? <span>{item.walk_distance_km.toFixed(1)} km on foot</span> : null}

          {/* Honesty about what we could not confirm (§53). */}
          {item.verification_status === "UNCERTAIN" ? (
            <span className="text-clay">Worth checking before you go</span>
          ) : null}

          {item.booking_required ? <span className="text-clay">Book ahead</span> : null}
        </div>

        {item.maps_url ? (
          <a
            href={item.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[14px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Open in Maps
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function Timeline({ items, market }: { items: PlanItem[]; market: Market }) {
  return (
    <ol className="rule">
      {items.map((item, index) => (
        <TimelineItem
          key={item.id}
          item={item}
          market={market}
          isLast={index === items.length - 1}
        />
      ))}
    </ol>
  );
}
