// Autopilot play generator — turns product signals into recommended actions
// (BUILD_SPEC §6). Pure + shared by the frontend and the backend engine, so the
// same logic produces plays for sample and real data alike. Each play carries a
// computed projected impact, reasoning, and the signals it read.

const BREAK_EVEN_ROAS = 1.8

const pct0 = (x) => Math.round(x * 100) + '%'
const sig = (label, value, kind) => [label, value, kind] // kind: bad | good | ref

// products: enriched rows (rev, cogs, ship, fees, ads, disc, ret, net, pct,
// status, leakLabel, roas, units, id, name). opts.money formats currency.
export function generatePlays(products, { approvalLimit = 5000, money = (n) => '$' + Math.round(n).toLocaleString('en-US') } = {}) {
  const sold = products.filter((p) => p.units > 0 && p.rev > 0)
  if (!sold.length) return []
  // "hero" = top quartile by revenue (gets budget trims, not hard pauses)
  const revsDesc = [...sold].map((p) => p.rev).sort((a, b) => b - a)
  const heroCut = revsDesc[Math.floor(revsDesc.length * 0.25)] ?? revsDesc[0]

  const out = []
  for (const p of sold) {
    const shareOf = (v) => (p.rev ? v / p.rev : 0)
    const marginTxt = (p.pct < 0 ? '−' : '') + Math.round(Math.abs(p.pct) * 100) + '%'
    const cand = []

    // --- Ad spend: trim (hero) or pause (the rest) when ROAS is below break-even ---
    if (p.ads > 0 && p.roas != null && p.roas < BREAK_EVEN_ROAS) {
      if (p.rev >= heroCut && p.pct < 0.12) {
        cand.push({
          type: 'Ad spend', action: 'Trim ad budget 20%', amt: Math.round(p.ads * 0.18),
          detail: `Hero SKU · ROAS ${p.roas}× below ${BREAK_EVEN_ROAS}× break-even`,
          why: `One of your highest-revenue products, but its ROAS (${p.roas}×) sits below the ${BREAK_EVEN_ROAS}× break-even — so part of its ${money(p.ads)} ad spend is pure loss. Trimming the lowest-performing 20% lifts net with minimal volume loss.`,
          signals: [sig('ROAS', p.roas + '×', 'bad'), sig('Break-even', BREAK_EVEN_ROAS + '×', 'ref'), sig('Ad spend', money(p.ads), 'bad'), sig('Revenue rank', 'top 25%', 'ref')],
        })
      } else {
        cand.push({
          type: 'Ad spend', action: 'Pause unprofitable ad spend', amt: Math.round(p.ads * Math.min(0.6, (BREAK_EVEN_ROAS - p.roas) / BREAK_EVEN_ROAS + 0.2)),
          detail: `ROAS ${p.roas}× below ${BREAK_EVEN_ROAS}× break-even`,
          why: `Every ad-driven sale here loses money: ROAS is ${p.roas}× against a ${BREAK_EVEN_ROAS}× break-even. Pausing the unprofitable spend stops the bleed while profitable audiences stay live.`,
          signals: [sig('ROAS', p.roas + '×', 'bad'), sig('Break-even', BREAK_EVEN_ROAS + '×', 'ref'), sig('Ad spend', money(p.ads), 'bad'), sig('Status', p.status, 'bad')],
        })
      }
    }

    // --- Returns: PDP guidance when returns eat a chunk of revenue ---
    if (shareOf(p.ret) > 0.15) {
      cand.push({
        type: 'Returns', action: 'Add PDP guidance to cut returns', amt: Math.round(p.ret * 0.4),
        detail: `Returns ${pct0(shareOf(p.ret))} of revenue`,
        why: `Returns are ${pct0(shareOf(p.ret))} of this product's revenue. A sizing / expectation note on the product page is the cheapest lever — it cuts returns without touching price or spend.`,
        signals: [sig('Return rate', pct0(shareOf(p.ret)), 'bad'), sig('Return cost', money(p.ret), 'bad'), sig('Est. recovered', money(Math.round(p.ret * 0.4)), 'good')],
      })
    }

    // --- Discounts: cap when promos erode an already-thin margin ---
    if (shareOf(p.disc) > 0.12 && p.pct < 0.12) {
      cand.push({
        type: 'Discounts', action: 'Cap promo codes at 10%', amt: Math.round(p.disc * 0.4),
        detail: `Discounts ${pct0(shareOf(p.disc))} of revenue`,
        why: `Discounts run ${pct0(shareOf(p.disc))} of revenue while the margin is only ${marginTxt} — capping codes at 10% keeps the incentive working without erasing the unit margin.`,
        signals: [sig('Avg discount', pct0(shareOf(p.disc)), 'bad'), sig('Margin', marginTxt, 'bad'), sig('Recoverable', money(Math.round(p.disc * 0.4)), 'good')],
      })
    }

    // --- Shipping: raise free-ship threshold when fulfillment is heavy ---
    if (shareOf(p.ship) > 0.2) {
      cand.push({
        type: 'Shipping', action: 'Raise free-ship threshold', amt: Math.round(p.ship * 0.25),
        detail: `Shipping ${pct0(shareOf(p.ship))} of revenue`,
        why: `Fulfillment is ${pct0(shareOf(p.ship))} of revenue. Lifting the free-shipping threshold nudges a second item into the cart or recovers the shipping cost on solo orders.`,
        signals: [sig('Shipping / rev', pct0(shareOf(p.ship)), 'bad'), sig('Est. AOV lift', money(Math.round(p.ship * 0.25)), 'good')],
      })
    }

    // --- Pricing: nudge price on a thin-margin SKU with no promo/return drag ---
    if (p.status === 'thin' && (p.roas == null || p.roas >= BREAK_EVEN_ROAS) && shareOf(p.disc) <= 0.12 && shareOf(p.ret) <= 0.15) {
      cand.push({
        type: 'Pricing', action: 'Test a 3% price increase', amt: Math.round(p.rev * 0.03),
        detail: `Thin ${marginTxt} margin, low promo/return pressure`,
        why: `Margin is thin at ${marginTxt} with little discount or return pressure. A small price test flows almost entirely to margin if volume holds.`,
        signals: [sig('Margin', marginTxt, 'bad'), sig('Discount load', pct0(shareOf(p.disc)), 'good'), sig('Est. lift', money(Math.round(p.rev * 0.03)), 'good')],
      })
    }

    // keep the two highest-impact plays per product
    cand.sort((a, b) => b.amt - a.amt)
    for (const c of cand.slice(0, 2)) {
      if (c.amt <= 0) continue
      out.push({
        id: `gen_${p.id}_${c.type.replace(/\s+/g, '').toLowerCase()}`,
        pid: p.id, base: c.amt > approvalLimit ? 'approval' : 'suggested',
        ...c,
      })
    }
  }
  // store-wide: biggest opportunities first
  return out.sort((a, b) => b.amt - a.amt)
}
