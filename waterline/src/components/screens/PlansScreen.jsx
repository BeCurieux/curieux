export default function PlansScreen({ v }) {
  return (
    <>
      {/* billing toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div onClick={v.toggleBill} style={{ position: 'relative', display: 'flex', background: '#E3E0D7', borderRadius: 11, padding: 3, cursor: 'pointer' }}>
          <div style={v.billToggleKnob} />
          <div style={v.billMoStyle}>Monthly</div>
          <div style={v.billYrStyle}>Annual <span style={{ background: '#1BB377', color: '#06231A', fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>−20%</span></div>
        </div>
      </div>

      {/* plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, alignItems: 'start', maxWidth: 1040, margin: '0 auto 22px' }}>
        {v.plans.map((p) => (
          <div key={p.id} style={p.cardStyle}>
            {p.highlight && (
              <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#1BB377', color: '#06231A', fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', padding: '4px 13px', borderRadius: 20, whiteSpace: 'nowrap' }}>PAYS FOR ITSELF</div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: p.nameColor, letterSpacing: '-.01em' }}>{p.name}</div>
            <div style={{ fontSize: 12.5, color: p.taglineColor, marginTop: 4, lineHeight: 1.4, minHeight: 34 }}>{p.tagline}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 14 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 34, fontWeight: 700, color: p.priceColor, letterSpacing: '-.02em' }}>{p.priceText}</span>
              <span style={{ fontSize: 13, color: p.perColor, fontWeight: 600 }}>{p.per}</span>
            </div>
            <div style={{ fontSize: 12, color: p.noteColor, fontWeight: 700, marginTop: 5, minHeight: 17 }}>{p.note}</div>
            <button onClick={p.pick} style={p.ctaStyle}>{p.cta}</button>
            <div style={{ height: 1, background: p.divider, margin: '18px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {p.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.tickColor} strokeWidth="2.4" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6 9 17l-5-5" /></svg>
                  <span style={{ fontSize: 12.5, color: p.featColor, lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* value-based ROI proof */}
      <div style={{ maxWidth: 1040, margin: '0 auto 18px', background: 'linear-gradient(108deg,#EEF5F1,#E3EFE9)', border: '1px solid rgba(14,143,94,.2)', borderRadius: 18, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 30 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#0E8F5E' }}>WHY AUTOPILOT+ COSTS YOU NOTHING TO TRY</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#16242E', marginTop: 7, lineHeight: 1.35, maxWidth: 440, letterSpacing: '-.01em' }}>You only pay the 12% on margin Waterline has <span style={{ color: '#0E8F5E' }}>verifiably recovered</span> — proven in the Impact Ledger, and reversible.</div>
          <div style={{ fontSize: 12.5, color: '#42584F', marginTop: 8, lineHeight: 1.5, maxWidth: 460 }}>If it recovers nothing, the variable fee is zero. The math only works in your favor.</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.08)', borderRadius: 14, padding: '20px 22px', minWidth: 230 }}>
          <div style={{ fontSize: 11.5, color: '#8B98A1', fontWeight: 600 }}>Your last 30 days, on Autopilot+</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#3C4B48' }}>Margin recovered</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: '#0E8F5E' }}>{v.roiRecoveredText}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9 }}>
            <span style={{ fontSize: 13, color: '#3C4B48' }}>Waterline fee (12%)</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: '#6A7780' }}>−{v.roiFeeText}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(22,36,46,.1)', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: '#16242E', fontWeight: 700 }}>You keep</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: '#16242E' }}>{v.roiKeepText}</span>
          </div>
        </div>
      </div>

      {/* enterprise strip */}
      <div style={{ maxWidth: 1040, margin: '0 auto', background: '#fff', border: '1px solid rgba(22,36,46,.08)', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16242E' }}>Enterprise &amp; multi-store</div>
          <div style={{ fontSize: 12.5, color: '#6A7780', marginTop: 3, lineHeight: 1.5 }}>For brands above $20M GMV or running multiple storefronts. Custom guardrail policies, SSO, API access, and a dedicated strategist.</div>
        </div>
        <button style={{ background: '#F1EFE9', color: '#16242E', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '11px 20px', borderRadius: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Talk to us</button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: '#9AA7AE', marginTop: 20 }}>Cancel anytime · No setup fees · 14-day money-back on flat plans</div>
    </>
  )
}
