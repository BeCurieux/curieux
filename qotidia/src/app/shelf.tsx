// The shelf.
//
// Nineteen fixed colours, one per age, already existed in colours.ts and were
// only ever seen on a printed cover. That was a waste of the strongest thing
// the brand owns: a row of these is identifiable across a room, and the gap
// in the sequence is visible to the parent and to everyone who visits them.
//
// So the spectrum belongs on screen too — before anyone has bought anything,
// so the set is legible as a set rather than discovered one year at a time.

import { AGE_COLOURS, colourForAge } from "@/lib/book/colours";
import { yearWord } from "@/lib/book/structure";

/** Heights vary slightly so a row reads as books rather than as a chart. */
const HEIGHTS = [13.5, 14.5, 14, 15, 14.25, 15.25, 14.75, 13.75];

export function Shelf({
  from = 1,
  count = 8,
  owned,
  current,
  className = "",
}: {
  /** First age shown. */
  from?: number;
  /** How many volumes to draw. */
  count?: number;
  /** Ages the family already has. Undefined means "show them all as real". */
  owned?: number[];
  /** The volume being made now, drawn slightly proud of the rest. */
  current?: number;
  className?: string;
}) {
  const ages = Array.from({ length: count }, (_, i) => from + i).filter(
    (a) => a <= AGE_COLOURS[AGE_COLOURS.length - 1].age
  );

  return (
    <div
      className={`flex items-end gap-1.5 overflow-x-auto border-b-[3px] border-rule pb-4 ${className}`}
      role="img"
      aria-label={`A shelf of annual volumes, ${yearWord(ages[0])} to ${yearWord(
        ages[ages.length - 1]
      )}.`}
    >
      {ages.map((age, i) => {
        const colour = colourForAge(age);
        const has = !owned || owned.includes(age);
        const isCurrent = current === age;
        const height = HEIGHTS[i % HEIGHTS.length] + (isCurrent ? 1 : 0);

        // A volume that doesn't exist yet is drawn as the space it will take,
        // not as an advert for it.
        if (!has) {
          return (
            <div
              key={age}
              className="spine !justify-center border border-dashed border-rule"
              style={{ height: `${height}rem` }}
            >
              <span className="[writing-mode:vertical-rl] whitespace-nowrap text-xs text-stone">
                {yearWord(age).toLowerCase()}
              </span>
            </div>
          );
        }

        return (
          <div
            key={age}
            className="spine shadow-sm"
            style={{
              height: `${height}rem`,
              backgroundColor: colour.hex,
              color: colour.inkHex,
              outline: isCurrent ? `2px solid ${colour.inkHex}` : undefined,
              outlineOffset: "2px",
            }}
            title={`${yearWord(age)} — ${colour.name}`}
          >
            <span className="[writing-mode:vertical-rl] whitespace-nowrap text-sm">
              {yearWord(age).toLowerCase()}
            </span>
            <span className="text-[0.6rem] tracking-widest opacity-70">{age}</span>
          </div>
        );
      })}
    </div>
  );
}
