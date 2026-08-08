/**
 * TasteInsight (§34).
 *
 * One line, no chrome, set in the serif. It exists to make the customer feel
 * noticed rather than measured — which is why it never appears unless the
 * evidence genuinely supports it, and why there is no dashboard of statistics
 * underneath it.
 */
export function TasteInsight({ insight }: { insight: string }) {
  return (
    <div className="rounded-card border border-rule bg-sage/50 px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-forest">
        What we’ve noticed
      </p>
      <p className="mt-2 font-display text-[19px] leading-snug text-ink">{insight}</p>
    </div>
  );
}
