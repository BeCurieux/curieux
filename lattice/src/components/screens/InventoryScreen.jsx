import { T, chip, panel, cardHeading, switchTrack, switchKnob } from '../../lib/styles.js'
import { ScreenHeader } from '../Bits.jsx'
import { IconWarehouse, IconCheck, IconWarnTri } from '../Icons.jsx'

const impactColor = { warn: T.warn, amber: T.amber, muted: T.muted2 }

// One warehouse stock cell: green when healthy, terracotta when low, a
// white-on-terracotta chip when depleted (0).
function StockCell({ n, lowAt = 8 }) {
  if (n <= 0) {
    return (
      <span style={{ width: 120, textAlign: 'center', color: '#fff', fontWeight: 700 }}>
        <span style={{ background: T.warn, padding: '3px 10px', borderRadius: 7 }}>0</span>
      </span>
    )
  }
  const color = n <= lowAt ? T.warn : T.green
  return <span style={{ width: 120, textAlign: 'center', color, fontWeight: 700 }}>{n}</span>
}

<<<<<<< Updated upstream
const blockedCopy = {
  ny: 'Tote depleted — bundle auto-hidden East-Coast.',
  la: 'A component is depleted — bundle auto-hidden here.',
}

=======
>>>>>>> Stashed changes
export default function InventoryScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        title="Inventory"
        subtitle="Bundle availability is gated by the weakest component — evaluated per warehouse, in real time."
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {v.warehouses.map((w) => (
              <span key={w.id} onClick={() => v.setWarehouse(w.id)} style={chip(v.warehouse === w.id)}>{w.name}</span>
            ))}
          </div>
        }
      />

      {/* routing toggle banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 14, padding: '15px 20px', marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.accentTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <IconWarehouse />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>Fulfillment warehouse routing</div>
          <div style={{ fontSize: 12, color: T.muted2, marginTop: 2 }}>Hide bundles where any component is depleted in the buyer's region — prevents split shipments &amp; overselling.</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.body, fontWeight: 600, cursor: 'pointer' }} onClick={v.toggleRouting}>
          {v.routingOn ? 'On' : 'Off'}
          <span style={switchTrack(v.routingOn)}><span style={switchKnob(v.routingOn)} /></span>
        </label>
      </div>

      {/* matrix */}
      <div style={panel}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.divider}` }}>
          <span style={cardHeading}>Component stock by location</span>
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: T.inset, fontSize: 10.5, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '.04em', padding: '11px 16px', borderRadius: 9, margin: 4 }}>
            <span style={{ flex: 1.6 }}>Component</span>
<<<<<<< Updated upstream
            {v.visibleRegions.map((w) => (
              <span key={w.id} style={{ width: 120, textAlign: 'center' }}>{w.name}</span>
            ))}
=======
            <span style={{ width: 120, textAlign: 'center' }}>Los Angeles</span>
            <span style={{ width: 120, textAlign: 'center' }}>New York</span>
>>>>>>> Stashed changes
            <span style={{ width: 130, textAlign: 'right' }}>Bundle impact</span>
          </div>
          {v.matrix.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px', fontSize: 13, borderTop: `1px solid ${T.divider2}`,
              ...(c.out ? { background: T.warnTint2, borderRadius: 9, margin: '2px 4px', borderTop: 'none' } : {}),
            }}>
              <span style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: '#dfe8d9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.out ? '#4f8a68' : '#5f7a52', fontWeight: 700, fontSize: 11 }}>{c.code}</span>
                <span>
                  <b style={{ color: T.ink }}>{c.name}</b><br />
                  <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono }}>{c.sku}</span>
                </span>
              </span>
<<<<<<< Updated upstream
              {v.visibleRegions.map((w) => (
                <StockCell key={w.id} n={c.stock[w.id]} lowAt={c.lowAt || 8} />
              ))}
=======
              <StockCell n={c.stock.la} lowAt={c.lowAt || 8} />
              <StockCell n={c.stock.ny} lowAt={c.lowAt || 8} />
>>>>>>> Stashed changes
              <span style={{ width: 130, textAlign: 'right', fontSize: 11.5, fontWeight: c.impactKind === 'warn' ? 700 : 400, color: impactColor[c.impactKind] || T.muted2 }}>{c.impact}</span>
            </div>
          ))}
        </div>
      </div>

      {/* result row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
        {v.results.map((r) => (
          <div key={r.warehouse.id} style={{ flex: 1, background: r.blocked ? T.warnTint : T.greenTint, border: `1px solid ${r.blocked ? T.warnBorder : T.greenBorder}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: r.blocked ? T.warn : T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              {r.blocked ? <IconWarnTri /> : <IconCheck />}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: r.blocked ? T.warnText : T.greenDeeper }}>{r.warehouse.name} · {r.blocked ? 'blocked' : 'shippable'}</div>
              <div style={{ fontSize: 12, color: r.blocked ? T.warnText2 : T.greenSoft, marginTop: 2 }}>
<<<<<<< Updated upstream
                {r.blocked ? (blockedCopy[r.warehouse.id] || 'A component is depleted — bundle auto-hidden here.') : `${r.count} full 3-Packs can ship today.`}
=======
                {r.blocked ? 'Tote depleted — bundle auto-hidden East-Coast.' : `${r.count} full 3-Packs can ship today.`}
>>>>>>> Stashed changes
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
