// Filled seats, open temporary spots, and empty capacity, on one bar.
export function OccupancyBar({
  expected,
  vacancies,
  capacity,
}: {
  expected: number;
  vacancies: number;
  capacity: number;
}) {
  const pct = (n: number) => `${(n / capacity) * 100}%`;
  return (
    <div
      role="img"
      aria-label={`${expected} of ${capacity} places filled, ${vacancies} open to fill`}
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-soft"
    >
      <span className="h-full bg-ink" style={{ width: pct(expected) }} />
      <span className="h-full bg-coral" style={{ width: pct(vacancies) }} />
    </div>
  );
}
