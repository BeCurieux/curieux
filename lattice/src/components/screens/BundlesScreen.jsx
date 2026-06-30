import { T, primaryBtn, pill, stepBtn } from '../../lib/styles.js'
import { ScreenHeader, Mono } from '../Bits.jsx'
import { IconShield } from '../Icons.jsx'

function StepBadge({ n }) {
  return (
    <span style={{ width: 26, height: 26, borderRadius: '50%', background: T.accent, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display }}>{n}</span>
  )
}

function ProductRow({ c }) {
  const warn = c.out
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 14, background: warn ? T.warnTint2 : T.inset, border: `1px solid ${warn ? T.warnBorder : T.tileBorder}`, borderRadius: 13 }}>
      <Mono name={c.tile} code={c.code} size={54} radius={11} fontSize={13} />
      <div style={{ flex: 1, minWidth: 0 }}>
<<<<<<< Updated upstream
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: T.ink }}>{c.name}</div>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: T.muted, fontFamily: T.mono }}>{c.lineText}</div>
        </div>
=======
        <div style={{ fontWeight: 700, fontSize: 14.5, color: T.ink }}>{c.name}</div>
>>>>>>> Stashed changes
        <div style={{ fontSize: 11.5, marginTop: 2, fontFamily: T.mono, color: warn ? T.warn : T.muted2, fontWeight: warn ? 600 : 400 }}>{c.stockLine}</div>
        <div style={{ display: 'flex', gap: 7, marginTop: 9, alignItems: 'center' }}>
          {c.swatches.map((sw) => {
            const selected = c.selectedSwatch === sw.name
            return (
              <div
                key={sw.name}
                onClick={() => c.pickSwatch(sw.name)}
                title={sw.name}
                style={{
                  width: 23, height: 23, borderRadius: 7, background: sw.color, cursor: 'pointer',
                  border: selected ? `2px solid ${T.accent}` : `1px solid ${T.tileBorder2}`,
                  boxShadow: selected ? `0 0 0 2px ${T.accentTint}` : 'none',
                }}
              />
            )
          })}
          <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 700, color: T.body, background: '#fff', border: `1px solid ${T.tileBorder2}`, padding: '4px 10px', borderRadius: 7 }}>{c.size}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: `1px solid ${T.tileBorder2}`, borderRadius: 9, padding: 4 }}>
        <button style={stepBtn} onClick={c.dec}>–</button>
        <span style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: 13, color: T.ink }}>{c.qty}</span>
        <button style={stepBtn} onClick={c.inc}>+</button>
      </div>
    </div>
  )
}

const validChannels = [
  { glyph: 'f', bg: '#1877f2', color: '#fff', name: 'Meta Shopping' },
  { glyph: 'G', bg: '#fff', color: '#4285f4', bordered: true, name: 'Google Merchant' },
  { glyph: 'P', bg: '#e60023', color: '#fff', name: 'Pinterest' },
]

export default function BundlesScreen({ v }) {
<<<<<<< Updated upstream
  const b = v.activeBundle
  const s = v.summary
  const sub = v.pricingMode === 'subscription'
  const canSub = b.subscribable
=======
  const b = v.summer
  const isSub = v.pricingMode === 'subscription'
>>>>>>> Stashed changes
  return (
    <div className="lt-screen">
      <ScreenHeader
        title={b.name}
<<<<<<< Updated upstream
        subtitle={<>Mix &amp; match · <b style={{ color: T.body }}>{s.itemCount} items in pack</b> · {canSub ? 'subscription-ready' : 'one-time pack'}</>}
        right={
          <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
            <span style={pill(b.published ? 'ok' : 'accent')}><span style={{ width: 7, height: 7, borderRadius: '50%', background: b.published ? T.green : T.accent }} />{b.published ? 'Published' : 'Draft'}</span>
=======
        subtitle={<>Mix &amp; match · <b style={{ color: T.body }}>3 items in pack</b> · subscription-ready</>}
        right={
          <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
            <span style={pill('ok')}><span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />Published</span>
>>>>>>> Stashed changes
            <button className="lt-btn" style={{ ...primaryBtn, padding: '11px 20px' }} onClick={v.saveBundle}>Save bundle</button>
          </div>
        }
      />

      {/* bundle switcher tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
<<<<<<< Updated upstream
        {v.bundleTabs.map((t) => (
          <span key={t.id} onClick={t.select} style={{
            fontSize: 12.5, fontWeight: t.active ? 700 : 600, padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
            color: t.active ? T.accentDeep : T.muted,
            background: t.active ? T.accentTint : T.raised,
            border: `1px solid ${t.active ? T.accentBorder : T.border}`,
          }}>{t.name}</span>
        ))}
        <span onClick={v.newBundle} style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, background: '#fff', border: `1.5px dashed ${T.dash}`, padding: '7px 14px', borderRadius: 9, cursor: 'pointer' }}>+ New</span>
=======
        {v.bundles.map((bundle, i) => (
          <span key={bundle.id} onClick={() => i !== 0 && v.saveBundle()} style={{
            fontSize: 12.5, fontWeight: i === 0 ? 700 : 600, padding: '7px 14px', borderRadius: 9, cursor: i === 0 ? 'default' : 'pointer',
            color: i === 0 ? T.accentDeep : T.muted,
            background: i === 0 ? T.accentTint : T.raised,
            border: `1px solid ${i === 0 ? T.accentBorder : T.border}`,
          }}>{bundle.name}</span>
        ))}
        <span onClick={v.addProduct} style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, background: '#fff', border: `1.5px dashed ${T.dash}`, padding: '7px 14px', borderRadius: 9, cursor: 'pointer' }}>+ New</span>
>>>>>>> Stashed changes
      </div>

      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
        {/* left column */}
        <div style={{ flex: 1.6, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* step 1 */}
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <StepBadge n="1" />
              <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink }}>What's in the pack?</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.faint, fontWeight: 600 }}>Inventory links sync in real time</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {v.components.map((c) => <ProductRow key={c.id} c={c} />)}
            </div>
            <button className="lt-btn" style={{ marginTop: 14, width: '100%', padding: 12, background: '#fff', border: `1.5px dashed ${T.dash}`, borderRadius: 12, color: T.accent, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }} onClick={v.addProduct}>+ Add another product to the pack</button>
          </div>

          {/* step 2 */}
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <StepBadge n="2" />
              <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink }}>How should shoppers buy it?</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
<<<<<<< Updated upstream
              <div onClick={() => v.setPricingMode('onetime')} style={{ flex: 1, border: `${sub ? 1.5 : 2}px solid ${sub ? T.tileBorder2 : T.accent}`, borderRadius: 13, padding: 15, background: sub ? T.inset : T.accentTint, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink, marginBottom: 4 }}>One-time pack</div>
                <div style={{ fontSize: 12, color: T.muted2 }}>Buy all {s.itemCount} items together, once.</div>
              </div>
              <div onClick={() => canSub && v.setPricingMode('subscription')} style={{ flex: 1, border: `${sub ? 2 : 1.5}px solid ${sub ? T.accent : T.tileBorder2}`, borderRadius: 13, padding: 15, background: sub ? T.accentTint : T.inset, position: 'relative', cursor: canSub ? 'pointer' : 'not-allowed', opacity: canSub ? 1 : 0.55 }}>
                <span style={{ position: 'absolute', top: -9, right: 14, background: T.green, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>SELLING PLAN</span>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink, marginBottom: 4 }}>Subscribe &amp; save 10%</div>
                <div style={{ fontSize: 12, color: T.muted2 }}>{canSub ? 'Recurring box · cancel anytime.' : 'Not available for this pack.'}</div>
                {canSub && (
                  <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                    {v.cadences.map((cad) => {
                      const on = v.cadence === cad.id
                      return (
                        <span key={cad.id} onClick={(e) => { e.stopPropagation(); v.setCadence(cad.id) }} style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? T.accentDeep : T.muted2, background: '#fff', border: `1px solid ${on ? T.accentBorder : T.tileBorder2}`, padding: '4px 11px', borderRadius: 8, cursor: 'pointer' }}>{cad.label}</span>
                      )
                    })}
                  </div>
                )}
=======
              <div onClick={() => v.setPricingMode('onetime')} style={{ flex: 1, border: `${isSub ? 1.5 : 2}px solid ${isSub ? T.tileBorder2 : T.accent}`, borderRadius: 13, padding: 15, background: isSub ? T.inset : T.accentTint, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink, marginBottom: 4 }}>One-time pack</div>
                <div style={{ fontSize: 12, color: T.muted2 }}>Buy all 3 items together, once.</div>
              </div>
              <div onClick={() => v.setPricingMode('subscription')} style={{ flex: 1, border: `${isSub ? 2 : 1.5}px solid ${isSub ? T.accent : T.tileBorder2}`, borderRadius: 13, padding: 15, background: isSub ? T.accentTint : T.inset, position: 'relative', cursor: 'pointer' }}>
                <span style={{ position: 'absolute', top: -9, right: 14, background: T.green, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>SELLING PLAN</span>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink, marginBottom: 4 }}>Subscribe &amp; save 10%</div>
                <div style={{ fontSize: 12, color: T.muted2 }}>Recurring box · cancel anytime.</div>
                <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                  {v.cadences.map((cad) => {
                    const on = v.cadence === cad.id
                    return (
                      <span key={cad.id} onClick={(e) => { e.stopPropagation(); v.setCadence(cad.id) }} style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? T.accentDeep : T.muted2, background: '#fff', border: `1px solid ${on ? T.accentBorder : T.tileBorder2}`, padding: '4px 11px', borderRadius: 8, cursor: 'pointer' }}>{cad.label}</span>
                    )
                  })}
                </div>
>>>>>>> Stashed changes
              </div>
            </div>
          </div>
        </div>

        {/* right column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
<<<<<<< Updated upstream
          {/* pack summary (dark) — live */}
          <div style={{ background: T.dark, borderRadius: 16, padding: '20px 22px', color: T.appBg }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, marginBottom: 15, color: '#fff' }}>Pack summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.darkBody, marginBottom: 9 }}><span>{s.itemCount} items in pack</span><span>${s.subtotal.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.darkBody, marginBottom: 9 }}><span>Bundle saving</span><span style={{ color: T.greenOnDark }}>−${s.saving.toFixed(2)}</span></div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '13px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Pack price</span>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 24, color: '#fff' }}>${s.price.toFixed(2)}</span>
            </div>
            {canSub && <div style={{ marginTop: 6, fontSize: 11.5, color: T.greenOnDark, textAlign: 'right' }}>or ${s.subPrice}/mo subscribed</div>}
=======
          {/* pack summary (dark) */}
          <div style={{ background: T.dark, borderRadius: 16, padding: '20px 22px', color: T.appBg }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, marginBottom: 15, color: '#fff' }}>Pack summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.darkBody, marginBottom: 9 }}><span>3 items in pack</span><span>${b.listPrice.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.darkBody, marginBottom: 9 }}><span>Bundle saving</span><span style={{ color: T.greenOnDark }}>−${b.saving.toFixed(2)}</span></div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '13px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Pack price</span>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 24, color: '#fff' }}>${b.price.toFixed(2)}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, color: T.greenOnDark, textAlign: 'right' }}>or ${b.subPrice}/mo subscribed</div>
>>>>>>> Stashed changes
            <div style={{ marginTop: 15, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,255,255,.06)', borderRadius: 11, padding: '11px 12px' }}>
              <IconShield />
              <div style={{ fontSize: 11, color: T.darkBody, lineHeight: 1.45 }}>Priced on Shopify Functions — no flicker, no layout shift in the cart.</div>
            </div>
          </div>

          {/* ready for ads */}
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.ink, marginBottom: 13 }}>Ready for your ads</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {validChannels.map((ch) => (
                <div key={ch.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.body, fontWeight: 600 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: ch.bg, border: ch.bordered ? `1px solid ${T.tileBorder2}` : 'none', color: ch.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ch.glyph}</span>
                  {ch.name}
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.green, fontWeight: 700 }}>Validated</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: T.muted2, lineHeight: 1.45 }}>Component parts auto-append to the parent feed, so every bundle passes catalog review.</div>
          </div>

          {/* lighthouse */}
          <div style={{ background: T.greenTint, border: `1px solid ${T.greenBorder}`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(${T.green} 356deg,${T.greenBorder} 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: T.greenTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 700, fontSize: 18, color: T.greenDeep }}>99</div>
            </div>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.greenDeeper }}>Lighthouse stays green</div>
              <div style={{ fontSize: 12, color: T.greenSoft, marginTop: 4, lineHeight: 1.4 }}>11 kb vanilla-JS widget, loaded async. 0 ms layout shift.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
