// Static sample data for the fictional store "Harbor & Vine".
// In production these come from the ingestion pipeline (see BUILD_SPEC.md §3, §9).
// Numbers are realistic mock data; wire to real computed values per the spec.

// Per-product base figures over the 30d window (the `factor()` scales to 90d / 12mo).
export const BASE = [
  { id: 'bottle',  name: 'Insulated Bottle 32oz',    short: 'Bottle',      cat: 'Drinkware',   units: 512, rev: 28400, cogs: 9100,  ship: 2300, fees: 820,  ads: 3400,  disc: 1100, ret: 600  },
  { id: 'tee',     name: 'Merino Base Layer Tee',    short: 'Merino Tee',  cat: 'Apparel',     units: 392, rev: 19600, cogs: 7800,  ship: 1500, fees: 560,  ads: 4200,  disc: 900,  ret: 1300 },
  { id: 'daypack', name: 'Canvas Daypack',           short: 'Daypack',     cat: 'Bags',        units: 221, rev: 22100, cogs: 8900,  ship: 1900, fees: 640,  ads: 3100,  disc: 700,  ret: 800  },
  { id: 'jacket',  name: 'Alpine Down Jacket',       short: 'Down Jacket', cat: 'Outerwear',   units: 164, rev: 41000, cogs: 19500, ship: 2100, fees: 1200, ads: 11800, disc: 2400, ret: 3600 },
  { id: 'socks',   name: 'Wool Hiking Socks 3-pack', short: 'Wool Socks',  cat: 'Apparel',     units: 328, rev: 8200,  cogs: 3100,  ship: 1400, fees: 240,  ads: 1900,  disc: 500,  ret: 200  },
  { id: 'cap',     name: 'Trail Runner Cap',         short: 'Trail Cap',   cat: 'Accessories', units: 276, rev: 6900,  cogs: 2400,  ship: 1600, fees: 210,  ads: 2500,  disc: 1300, ret: 700  },
  { id: 'shell',   name: 'Packable Rain Shell',      short: 'Rain Shell',  cat: 'Outerwear',   units: 153, rev: 15300, cogs: 7200,  ship: 1800, fees: 470,  ads: 5100,  disc: 1400, ret: 3900 },
  { id: 'mug',     name: 'Camp Mug Set',             short: 'Camp Mug',    cat: 'Drinkware',   units: 184, rev: 4600,  cogs: 2100,  ship: 1500, fees: 150,  ads: 1200,  disc: 400,  ret: 180  },
  { id: 'fleece',  name: 'Sunday Fleece',            short: 'Fleece',      cat: 'Apparel',     units: 236, rev: 11800, cogs: 5400,  ship: 1300, fees: 360,  ads: 3900,  disc: 1500, ret: 1100 },
]

export const CAT_COLOR = { Drinkware: '#3E7CA6', Apparel: '#6B8E4E', Bags: '#A6713E', Outerwear: '#7A5EA6', Accessories: '#B0894A' }

// Sample per-product ad ROAS (attributed revenue / ad spend). Low-ROAS SKUs line
// up with the underwater/thin products the Autopilot plays target. Real-store
// ROAS comes from the attribution engine once ad platforms are connected.
export const SEED_ROAS = { bottle: 4.2, tee: 2.1, daypack: 3.5, jacket: 1.3, socks: 2.8, cap: 1.6, shell: 1.1, mug: 2.4, fleece: 1.5 }

// Opportunity recommendations shown in the drawer when a product has no Autopilot plays.
export const RECS_MAP = {
  bottle: [
    { t: 'Your best earner with a healthy 39% margin. A/B a 6% price lift — elasticity here is low.', i: '+$1,700/mo' },
    { t: 'Shift 10% of ad budget here, away from underwater SKUs.', i: 'reallocates spend' },
  ],
  tee: [
    { t: 'Returns run 6.6% of revenue — a fit guide on the PDP should trim them.', i: '+$600/mo' },
    { t: 'Margin is thin at 17%. Bundle with Wool Socks to lift AOV.', i: '+$900/mo' },
  ],
  daypack: [
    { t: 'Solid 27% margin. Feature in email — your lowest-CAC channel.', i: '+$1,100/mo' },
  ],
  jacket: [
    { t: 'Your #1 by revenue, but only 1% net — $11.8k ads + $3.6k returns nearly sink it.', i: 'protect $400' },
    { t: 'Trim Performance Max 20% (ROAS is 1.3x) and net jumps fast.', i: '+$6,100/mo' },
  ],
  socks: [
    { t: 'Thin 10% margin. Raise price $2 — it sells as a low-resistance add-on.', i: '+$650/mo' },
  ],
  cap: [
    { t: 'Underwater. You discount 19% on a $25 item — cap promos at 10%.', i: '+$900/mo' },
    { t: 'Shipping is 23% of revenue. Raise the free-ship threshold above $35.', i: '+$700/mo' },
  ],
  shell: [
    { t: 'Returns are 25% of revenue (top reason: "runs small") — add size-up guidance.', i: '+$2,400/mo' },
    { t: 'ROAS is 1.1x. Pause broad prospecting, keep retargeting only.', i: '+$2,100/mo' },
  ],
  mug: [
    { t: 'Shipping (33%) exceeds COGS. Bundle with the Bottle to clear the waterline.', i: '+$900/mo' },
    { t: 'Or raise price to $32 — demand is gift-driven and inelastic.', i: '+$600/mo' },
  ],
  fleece: [
    { t: 'CAC is $17/unit on a $50 item. Pause cold prospecting; keep warm audiences.', i: '+$1,600/mo' },
    { t: 'Discounts run 13% — exclude it from sitewide promos.', i: '+$500/mo' },
  ],
}

// Autonomous plays — the Autopilot layer. `why` = reasoning, `signals` = the data it read.
export const PLAYS = [
  { id: 'p1', pid: 'shell', type: 'Ad spend', action: 'Pause Performance Max prospecting', detail: 'ROAS held below 1.2× for 9 days', base: 'running', amt: 1840,
    why: 'This product loses money on every prospecting sale. Its Performance Max ROAS has sat below break-even for 9 straight days while still spending — so the spend is pure loss. Retargeting (ROAS 3.1×) stays untouched.',
    signals: [['Prospecting ROAS', '1.1×', 'bad'], ['Break-even ROAS', '1.9×', 'ref'], ['Days below', '9 of 9', 'bad'], ['Retargeting ROAS', '3.1×', 'good']] },
  { id: 'p2', pid: 'shell', type: 'Returns', action: 'Show "runs small — size up" on PDP', detail: 'Top return reason · 31% of returns', base: 'running', amt: 720,
    why: 'Returns are 25% of this product\'s revenue, and "runs small" is the reason on 31% of them. A size-up note on the product page is the cheapest lever — it cuts returns without touching price or spend.',
    signals: [['Return rate', '25% of rev', 'bad'], ['"Runs small"', '31% of returns', 'bad'], ['Cost / return', '$26', 'ref'], ['Est. returns avoided', '~14 / mo', 'good']] },
  { id: 'p3', pid: 'cap', type: 'Discounts', action: 'Cap promo codes at 10%', detail: 'Was discounting 19% on a $25 item', base: 'running', amt: 610,
    why: 'Stacked codes were averaging 19% off a $25 item — enough to erase the unit margin. Capping at 10% keeps the promo working as an incentive without sinking the product below its waterline.',
    signals: [['Avg discount', '19%', 'bad'], ['Margin at 19% off', '−4%', 'bad'], ['Margin at 10% off', '+11%', 'good'], ['Orders affected', '~31 / mo', 'ref']] },
  { id: 'p4', pid: 'cap', type: 'Shipping', action: 'Raise free-ship threshold to $35', detail: 'Shipping is 23% of revenue', base: 'suggested', amt: 700,
    why: 'Free shipping is being given on $25 single-cap orders where fulfillment is 23% of revenue. Lifting the threshold to $35 nudges a second item into the cart or recovers the shipping cost on solo orders.',
    signals: [['Shipping / rev', '23%', 'bad'], ['Avg order', '$27', 'ref'], ['Solo-item orders', '64%', 'bad'], ['Est. AOV lift', '+$6', 'good']] },
  { id: 'p5', pid: 'mug', type: 'AOV', action: 'Auto-bundle with Insulated Bottle', detail: 'Shipping exceeds COGS on a solo mug', base: 'suggested', amt: 900,
    why: 'Shipping a single mug costs more than the mug itself. Bundling it with the Insulated Bottle — frequently bought together — spreads fixed fulfillment across two items and clears the waterline.',
    signals: [['Shipping / rev', '33%', 'bad'], ['COGS / rev', '30%', 'ref'], ['Bought-together rate', '22%', 'good'], ['Bundle margin', '+18%', 'good']] },
  { id: 'p6', pid: 'fleece', type: 'Ad spend', action: 'Pause cold prospecting audiences', detail: 'CAC is $17 on a $50 item', base: 'approval', amt: 1600,
    why: 'Cold prospecting costs $17 to acquire a sale on a $50 item carrying ~$24 of other costs — so each cold sale nets near zero. Warm and retargeting audiences stay live; only unprofitable cold spend pauses.',
    signals: [['Cold CAC', '$17', 'bad'], ['Contribution / order', '$0.80', 'bad'], ['Warm ROAS', '2.6×', 'good'], ['Cold share of spend', '41%', 'ref']] },
  { id: 'p7', pid: 'jacket', type: 'Ad spend', action: 'Trim Performance Max budget 20%', detail: 'Hero SKU at 1% net — protect it', base: 'approval', amt: 6100,
    why: 'Your #1 revenue product nets only 1% because $11.8k of ad spend sits on top of it at 1.3× ROAS. Trimming the lowest-performing 20% of PMax spend lifts net sharply with minimal volume loss. Above your $5k auto-approval limit, so it\'s held for you.',
    signals: [['Net margin', '1%', 'bad'], ['Ad spend', '$11.8k', 'bad'], ['Blended ROAS', '1.3×', 'bad'], ['Bottom-20% ROAS', '0.7×', 'bad']] },
  { id: 'p8', pid: 'socks', type: 'Pricing', action: 'Raise price $2.00', detail: 'Low-resistance add-on at 10% margin', base: 'suggested', amt: 650,
    why: 'Sold mostly as a cart add-on, this product shows low price sensitivity — units barely move with prior price changes. A $2 lift on a $24 item flows almost entirely to margin.',
    signals: [['Current margin', '10%', 'bad'], ['Price elasticity', '−0.3 (low)', 'good'], ['Attach rate', '38%', 'good'], ['Margin after +$2', '+18%', 'good']] },
]

// Impact Ledger — proven, already-acted plays with before→after margin.
export const LEDGER = [
  { id: 'l1', pid: 'cap', action: 'Capped Trail Cap promo codes at 10%', type: 'Discounts', when: '2 days ago', before: -2, after: 11, recovered: 610,
    series: [-2, -2, -1, 2, 5, 7, 9, 10, 11], note: 'Conversion held steady — discount was deeper than it needed to be.' },
  { id: 'l2', pid: 'shell', action: 'Paused Rain Shell PMax prospecting', type: 'Ad spend', when: '9 days ago', before: -9, after: 14, recovered: 1840,
    series: [-9, -9, -7, -3, 1, 5, 8, 11, 14], note: 'Retargeting carried the volume — total orders down just 4%.' },
  { id: 'l3', pid: 'shell', action: 'Added "runs small — size up" to Rain Shell', type: 'Returns', when: '12 days ago', before: 14, after: 19, recovered: 720,
    series: [14, 14, 15, 15, 16, 17, 18, 18, 19], note: 'Return rate fell from 25% to 17% in two weeks.' },
]

export const BASE_ACTIVITY = [
  { when: '2h ago',     text: 'Autopilot capped Trail Cap promo codes at 10%',      delta: '+$38 recovered since', kind: 'good' },
  { when: '9:14 AM',    text: 'Paused Performance Max prospecting for Rain Shell',   delta: '+$1,840 this cycle',  kind: 'good' },
  { when: 'Yesterday',  text: 'Added "runs small — size up" note to Rain Shell PDP', delta: 'returns −31%',        kind: 'good' },
  { when: '3 days ago', text: 'You approved trimming the Down Jacket ad budget 20%', delta: 'tracking impact',     kind: 'info' },
  { when: 'Last week',  text: 'Flagged Camp Mug Set — bundle play awaiting approval', delta: '+$900/mo ready',     kind: 'warn' },
]

export const GUARDRAILS = [
  { label: 'Never pause ads on products above 20% margin', on: true },
  { label: 'Cap any discount Autopilot sets at 10%', on: true },
  { label: 'Pause spend only after 7 days of ROAS < 1.2×', on: true },
  { label: 'Require my approval above $5,000 monthly impact', on: true },
  { label: 'Limit Autopilot price changes to ±8%', on: false },
]

// Cost data sources + per-field confidence
export const SOURCES = [
  { id: 'shopify', name: 'Shopify',       detail: 'Orders, products, refunds · synced 4 min ago',          status: 'live',    icon: 'S', color: '#95BF47' },
  { id: 'meta',    name: 'Meta Ads',      detail: 'Spend & ROAS by product · synced 11 min ago',           status: 'live',    icon: 'M', color: '#0866FF' },
  { id: 'google',  name: 'Google Ads',    detail: 'Spend & ROAS by product · synced 18 min ago',           status: 'live',    icon: 'G', color: '#EA4335' },
  { id: 'cogs',    name: 'Cost of goods', detail: 'Imported from Shopify cost field · 6 of 9 verified',     status: 'partial', icon: '$', color: '#0E8F5E' },
  { id: 'tiktok',  name: 'TikTok Ads',    detail: 'Not connected — spend may be unattributed',             status: 'off',     icon: 'T', color: '#111'    },
]

// Confidence per product cost (for the cost table). See BUILD_SPEC.md §5.
export const COGS_CONF = { bottle: 'verified', tee: 'verified', daypack: 'verified', jacket: 'verified', socks: 'verified', cap: 'verified', shell: 'estimated', mug: 'estimated', fleece: 'missing' }

export const ALERT_FEED = [
  { id: 'a1', sev: 'critical', pid: 'mug',    title: 'Camp Mug Set crossed underwater',           body: 'Net margin fell to −4% after shipping costs rose. Losing money on every sale.', when: '2h ago',     act: 'autopilot' },
  { id: 'a2', sev: 'critical', pid: 'jacket', title: 'Alpine Down Jacket margin dropped 3.1 pts',  body: 'Ad spend up 18% week-over-week while ROAS slipped to 1.3×.',                     when: '5h ago',     act: 'autopilot' },
  { id: 'a3', sev: 'warning',  pid: 'shell',  title: 'Rain Shell returns spiked to 25% of revenue', body: '"Runs small" now the top reason on 31% of returns.',                            when: 'Yesterday',  act: 'view' },
  { id: 'a4', sev: 'warning',  pid: 'fleece', title: 'Sunday Fleece CAC exceeds contribution',     body: 'Cold prospecting at $17 CAC on a $50 item — near zero net per order.',           when: 'Yesterday',  act: 'autopilot' },
  { id: 'a5', sev: 'good',     pid: 'cap',    title: 'Trail Runner Cap recovered above water',     body: 'Margin climbed −2% → +11% after Autopilot capped its promo codes.',              when: '2 days ago', act: 'ledger' },
]

export const ALERT_RULES = [
  { label: 'A product crosses below 0% margin (underwater)', detail: 'Critical · notify immediately', on: true },
  { label: 'Margin drops more than 5 pts week-over-week',    detail: 'Warning · daily digest',        on: true },
  { label: "Returns exceed 15% of a product's revenue",      detail: 'Warning · daily digest',        on: true },
  { label: 'Ad ROAS falls below break-even for 3+ days',     detail: 'Warning · notify immediately',  on: true },
  { label: 'A product recovers back above water',            detail: 'Good news · weekly summary',    on: true },
  { label: 'A cost source disconnects or stops syncing',     detail: 'Critical · notify immediately', on: false },
]

// Style/label lookup tables shared across screens.
export const TYPE_COLOR = { 'Ad spend': '#7A5EA6', Returns: '#C13A34', Discounts: '#B0894A', Shipping: '#3E7CA6', AOV: '#0E8F5E', Pricing: '#6B8E4E' }

// Sample recent orders for the Orders screen (Harbor & Vine). Real-store orders
// come from Shopify ingestion; these are illustrative for the sample dataset.
export const ORDERS_SEED = [
  { id: '1042', when: '12 min ago', customer: 'Maya R.', items: 2, total: 138, status: 'fulfilled', lines: 'Insulated Bottle · Wool Socks' },
  { id: '1041', when: '1h ago', customer: 'Tom B.', items: 1, total: 250, status: 'paid', lines: 'Alpine Down Jacket' },
  { id: '1040', when: '3h ago', customer: 'Priya S.', items: 3, total: 96, status: 'fulfilled', lines: 'Camp Mug Set · Trail Cap · Wool Socks' },
  { id: '1039', when: '5h ago', customer: 'Jordan L.', items: 1, total: 50, status: 'refunded', lines: 'Packable Rain Shell' },
  { id: '1038', when: 'Yesterday', customer: 'Aisha K.', items: 1, total: 89, status: 'fulfilled', lines: 'Canvas Daypack' },
  { id: '1037', when: 'Yesterday', customer: 'Diego M.', items: 2, total: 74, status: 'paid', lines: 'Merino Base Layer Tee · Trail Cap' },
  { id: '1036', when: '2 days ago', customer: 'Lena F.', items: 1, total: 50, status: 'fulfilled', lines: 'Sunday Fleece' },
  { id: '1035', when: '2 days ago', customer: 'Sam W.', items: 4, total: 162, status: 'fulfilled', lines: 'Insulated Bottle ×2 · Camp Mug Set · Trail Cap' },
]
