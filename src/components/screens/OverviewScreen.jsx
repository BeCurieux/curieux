import { IconArrowRight } from '../Icons.jsx'

const card = { background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }

export default function OverviewScreen({ v }) {
  return (
    <>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
        {[
          { label: 'Revenue', value: v.kpiRevenue, color: '#16242E' },
          { label: 'True net profit', value: v.kpiNet, color: '#0E8F5E' },
          { label: 'Blended margin', value: v.kpiMargin, color: '#16242E' },
          { label: 'Recovered by Autopilot', value: v.recoveredText, color: '#0E8F5E' },
        ].map((k) => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1' }}>{k.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: k.color, marginTop: 8, letterSpacing: '-.02em' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* top earners */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Top earners</div>
            <div onClick={v.goMargins} style={{ fontSize: 12.5, color: '#3E7CA6', cursor: 'pointer', fontWeight: 600 }}>See all margins →</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {v.topProducts.map((p) => (
              <div key={p.id} onClick={p.open} className="wl-row" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, margin: '0 -8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.catColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16242E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9AA7AE' }}>{p.cat}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: p.netColor }}>{p.netText}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#9AA7AE', width: 48, textAlign: 'right' }}>{p.marginText}</div>
              </div>
            ))}
            {v.topProducts.length === 0 && <div style={{ fontSize: 13, color: '#9AA7AE' }}>No sales in this window yet.</div>}
          </div>
        </div>

        {/* right column: leak + autopilot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div onClick={v.setLeak ? () => { v.goMargins(); v.setLeak() } : v.goMargins} style={{ ...card, padding: '18px 20px', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1' }}>Underwater products</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#C13A34', marginTop: 6 }}>{v.kpiUnderCount}</div>
            <div style={{ fontSize: 12, color: '#A23A35', marginTop: 4, fontWeight: 600 }}>draining {v.kpiHiddenLoss}</div>
          </div>
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Autopilot</div>
              <div onClick={v.goAutopilot} style={{ fontSize: 12.5, color: '#3E7CA6', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Open <IconArrowRight size={13} color="#3E7CA6" /></div>
            </div>
            <div style={{ fontSize: 13, color: '#2C3A43', lineHeight: 1.5 }}>{v.runningCount} plays live · <b>{v.recoveredText}</b> recovered. {v.hasPending ? `${v.pendingCount} waiting on you (${v.pendingSumText}/mo).` : 'Nothing pending.'}</div>
          </div>
        </div>
      </div>

      {/* recent activity */}
      <div style={{ ...card, padding: '20px 22px', marginTop: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E', marginBottom: 14 }}>Recent activity</div>
        {v.activity.length === 0 && <div style={{ fontSize: 13, color: '#9AA7AE' }}>No activity yet — enable a play to get started.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {v.activity.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 11 }}>
              <div style={a.dotStyle} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: '#2C3A43', lineHeight: 1.4 }}>{a.text}</div>
                <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 2 }}><span style={{ fontWeight: 700, color: a.deltaColor }}>{a.delta}</span> · {a.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
