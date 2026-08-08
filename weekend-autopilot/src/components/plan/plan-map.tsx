/**
 * Route overview (§55).
 *
 * A numbered schematic of the stops in order, drawn as inline SVG from the
 * coordinates we already hold — not an embedded map. Three reasons: a map tile
 * embed is a per-load cost on a page people open weekly, embedding tiles
 * carries terms we would have to honour carefully, and the brief is explicit
 * that we should not build a navigation product.
 *
 * What a customer actually needs here is the shape of the day — are these
 * stops near each other, does it double back — and then a real map when they
 * are ready to go, which is what "Open in Maps" is for on each stop.
 */

import type { PlanItem } from "@/lib/types";
import { SectionLabel } from "@/components/ui";

export function PlanMap({ items }: { items: PlanItem[] }) {
  const stops = items
    .filter((i) => i.lat !== null && i.lng !== null && i.item_type !== "TRAVEL")
    .map((i, index) => ({ item: i, lat: i.lat as number, lng: i.lng as number, index }));

  if (stops.length < 2) return null;

  // Project to a unit box, then pad. Latitude is inverted because SVG y grows
  // downward; longitude is scaled by cos(lat) so the shape is not stretched
  // sideways at Sydney’s latitude.
  const meanLat = stops.reduce((sum, s) => sum + s.lat, 0) / stops.length;
  const lngScale = Math.cos((meanLat * Math.PI) / 180);

  const xs = stops.map((s) => s.lng * lngScale);
  const ys = stops.map((s) => -s.lat);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const span = Math.max(spanX, spanY);

  const PAD = 34;
  const SIZE = 260;
  const project = (x: number, y: number) => ({
    // Centre the smaller axis so a nearly-linear route is not stretched.
    cx: PAD + ((x - minX) + (span - spanX) / 2) / span * (SIZE - PAD * 2),
    cy: PAD + ((y - minY) + (span - spanY) / 2) / span * (SIZE - PAD * 2),
  });

  const points = stops.map((s, i) => ({
    ...project(s.lng * lngScale, -s.lat),
    label: String(i + 1),
    title: s.item.title,
  }));

  const path = points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");

  return (
    <div>
      <SectionLabel>The shape of the day</SectionLabel>
      <div className="mt-3 rounded-card border border-rule bg-white p-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-[220px] w-full shrink-0 sm:w-[240px]"
            role="img"
            aria-label={`Route through ${stops.length} stops, in order`}
          >
            <polyline
              points={path}
              fill="none"
              stroke="#22503F"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            {points.map((p) => (
              <g key={p.label}>
                <circle cx={p.cx} cy={p.cy} r={13} fill="#22503F" />
                <text
                  x={p.cx}
                  y={p.cy + 4.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize={12}
                  fontWeight={600}
                  fontFamily="system-ui, sans-serif"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>

          <ol className="min-w-0 flex-1 space-y-2">
            {points.map((p) => (
              <li key={p.label} className="flex gap-3 text-[15px] leading-snug">
                <span className="tabular w-4 shrink-0 text-mist">{p.label}</span>
                <span className="text-ink">{p.title}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-4 text-[13px] text-mist">
          A rough sense of the distances, not a map. Each stop has an “Open in Maps” link.
        </p>
      </div>
    </div>
  );
}
