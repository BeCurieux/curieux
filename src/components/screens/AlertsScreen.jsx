import { IconCheck } from '../Icons.jsx'

export default function AlertsScreen({ v }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
      {/* feed */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Triggered alerts</div>
          <span style={{ background: '#FBE8E6', color: '#C13A34', fontSize: 11.5, fontWeight: 700, padding: '3px 11px', borderRadius: 20 }}>{v.critCount} critical</span>
        </div>
        {v.hasAlerts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {v.alerts.map((a) => (
              <div key={a.id} style={{ position: 'relative', background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 14, padding: '16px 18px 16px 21px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
                <div style={a.railStyle} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                      <span style={a.sevPillStyle}>{a.sevText}</span>
                      <span style={{ fontSize: 11.5, color: '#9AA7AE' }}>{a.productName} · {a.when}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16242E', lineHeight: 1.35 }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: '#6A7780', lineHeight: 1.5, marginTop: 4 }}>{a.body}</div>
                  </div>
                  <button onClick={a.dismiss} style={{ background: 'transparent', border: 'none', color: '#C7C3B8', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
                <div style={{ marginTop: 12 }}><button onClick={a.act_fn} style={a.actStyle}>{a.actLabel}</button></div>
              </div>
            ))}
          </div>
        )}
        {v.noAlerts && (
          <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 16, padding: '46px 24px', textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#E4F3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><IconCheck color="#0E8F5E" sw={2.2} size={24} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>All clear — nothing underwater</div>
            <div style={{ fontSize: 12.5, color: '#9AA7AE', marginTop: 4 }}>Every product is above its waterline. We'll ping you the moment that changes.</div>
          </div>
        )}
      </div>
      {/* rules */}
      <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Alert rules</div>
        <div style={{ fontSize: 12.5, color: '#9AA7AE', marginTop: 2, marginBottom: 16 }}>Choose what Waterline watches for and how loudly it tells you.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {v.alertRules.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              <div onClick={r.toggle} style={r.trackStyle}><div style={r.knobStyle} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16242E', lineHeight: 1.35 }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 2 }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(22,36,46,.07)', fontSize: 12, color: '#9AA7AE', lineHeight: 1.5 }}>Delivered to <b style={{ color: '#6A7780' }}>jordan@harborandvine.com</b> and your Slack <b style={{ color: '#6A7780' }}>#ops</b> channel.</div>
      </div>
    </div>
  )
}
