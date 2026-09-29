import { cn } from "@/lib/utils";

// A ring that fills with a child's level progress. The number is written in
// the middle, so the ring is decoration and hidden from screen readers.
export function ProgressRing({
  value,
  size = 120,
  stroke = 12,
  className,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span className="tabular block font-display text-3xl leading-none font-semibold">
            {value}%
          </span>
          {label ? (
            <span className="mt-1 block text-xs font-semibold tracking-wide uppercase opacity-70">
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
