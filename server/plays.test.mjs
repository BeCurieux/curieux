// Run: node server/plays.test.mjs
// Generates Autopilot plays from the sample products and checks the right play
// types land on the right SKUs (signals → actions).

import assert from 'node:assert'
import { BASE, SEED_ROAS } from '../src/lib/data.js'
import { enrich } from '../src/lib/compute.js'
import { generatePlays } from '../src/lib/plays.js'

const enr = BASE.map((p) => enrich({ ...p, roas: SEED_ROAS[p.id] }, 1, {}))
const plays = generatePlays(enr)

let pass = 0
const ok = (n, c) => { assert.ok(c, n); console.log('  ✓', n); pass++ }
const typesFor = (pid) => plays.filter((p) => p.pid === pid).map((p) => p.type)

ok('generated some plays', plays.length > 0)
ok('every play has a projected amount > 0', plays.every((p) => p.amt > 0))
ok('every play has reasoning + signals', plays.every((p) => p.why && p.signals?.length))

// Rain Shell: underwater, returns 25%, low ROAS → returns + ad-spend plays
ok('shell → Returns play', typesFor('shell').includes('Returns'))
ok('shell → Ad spend play', typesFor('shell').includes('Ad spend'))

// Trail Cap: heavy discounting + high shipping on a cheap item
ok('cap → Discounts or Shipping play', typesFor('cap').some((t) => t === 'Discounts' || t === 'Shipping'))

// Down Jacket: hero SKU, thin margin, huge ad spend at 1.3× → trim budget (needs approval if > $5k)
ok('jacket → Ad spend play', typesFor('jacket').includes('Ad spend'))

// Wool Socks: thin margin, healthy ROAS, low promo/returns → pricing
ok('socks → Pricing play', typesFor('socks').includes('Pricing'))

// guardrail routing: any play over $5k auto-approval limit is flagged
const big = plays.find((p) => p.amt > 5000)
ok('plays over $5k routed to approval', !big || big.base === 'approval')

// at most two plays per product
const counts = {}
plays.forEach((p) => { counts[p.pid] = (counts[p.pid] || 0) + 1 })
ok('caps at 2 plays per product', Object.values(counts).every((c) => c <= 2))

console.log(`\n${pass} assertions passed · ${plays.length} plays generated`)
console.log(plays.map((p) => `  ${p.type.padEnd(10)} ${p.pid.padEnd(8)} +$${p.amt}/mo  ${p.base}`).join('\n'))
