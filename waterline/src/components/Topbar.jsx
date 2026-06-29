import { IconBolt } from './Icons.jsx'

export default function Topbar({ v }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 30px 16px', flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: '#16242E' }}>{v.pageTitle}</div>
        <div style={{ fontSize: 13, color: '#6A7780', marginTop: 2 }}>{v.pageSubtitle}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 2, background: '#E3E0D7', padding: 3, borderRadius: 10 }}>
          <button onClick={v.setRange30} style={v.range30Style}>30d</button>
          <button onClick={v.setRange90} style={v.range90Style}>90d</button>
          <button onClick={v.setRange12} style={v.range12Style}>12mo</button>
        </div>
        <div onClick={v.goAutopilot} className="wl-chip" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#16242E', padding: '7px 13px 7px 12px', borderRadius: 12, cursor: 'pointer' }}>
          <IconBolt fill="#1BB377" />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 9, color: '#7E8E97', fontWeight: 700, letterSpacing: '.06em' }}>AUTOPILOT · {v.apOnText}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: '#1BB377' }}>
              {v.recoveredText} <span style={{ color: '#7E8E97', fontWeight: 500, fontFamily: "'Hanken Grotesk',sans-serif" }}>recovered</span>
            </div>
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3E7CA6,#26577D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>JL</div>
      </div>
    </header>
  )
}
