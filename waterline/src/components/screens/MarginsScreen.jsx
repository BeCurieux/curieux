import WaterlineView from './WaterlineView.jsx'
import TriageView from './TriageView.jsx'
import LeakView from './LeakView.jsx'
import AutopilotView from './AutopilotView.jsx'
import { IconAlert, IconWaves, IconRows, IconBars, IconBolt } from '../Icons.jsx'

export default function MarginsScreen({ v }) {
  return (
    <>
      {/* insight banner */}
      {v.showBanner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, background: 'linear-gradient(100deg,#16242E,#1F3340)', borderRadius: 14, padding: '15px 20px', marginBottom: 20, boxShadow: '0 8px 24px rgba(22,36,46,.16)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(214,69,63,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconAlert color="#FF8A82" size={20} />
          </div>
          <div style={{ flex: 1, lineHeight: 1.45 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14.5 }}>{v.bannerCount} products are below your waterline</span>
            <span style={{ color: '#AEBCC4', fontSize: 14 }}> — quietly draining {v.bannerLoss} and 3 of them are still running in your top ad campaigns.</span>
          </div>
          <button onClick={v.setTriage} style={{ background: '#1BB377', color: '#06231A', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>Review offenders</button>
          <button onClick={v.dismissBanner} style={{ background: 'transparent', border: 'none', color: '#7E8E97', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1', letterSpacing: '.02em' }}>Revenue</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#16242E', marginTop: 8, letterSpacing: '-.02em' }}>{v.kpiRevenue}</div>
          <div style={{ fontSize: 12, color: '#6A7780', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#0E8F5E', fontWeight: 700 }}>▲ 6.2%</span> vs prior</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1', letterSpacing: '.02em' }}>True net profit</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#0E8F5E', marginTop: 8, letterSpacing: '-.02em' }}>{v.kpiNet}</div>
          <div style={{ fontSize: 12, color: '#6A7780', marginTop: 6 }}>after every variable cost</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1', letterSpacing: '.02em' }}>Blended margin</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#16242E', marginTop: 8, letterSpacing: '-.02em' }}>{v.kpiMargin}</div>
          <div style={{ fontSize: 12, color: '#6A7780', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#C0871C', fontWeight: 700 }}>▼ 2.1 pts</span> vs prior</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#FBE8E6,#F8DAD7)', border: '1px solid rgba(214,69,63,.25)', borderRadius: 15, padding: '18px 19px', cursor: 'pointer' }} onClick={v.setTriage}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A23A35', letterSpacing: '.02em' }}>Underwater products</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#C13A34', marginTop: 8, letterSpacing: '-.02em' }}>{v.kpiUnderCount}</div>
          <div style={{ fontSize: 12, color: '#A23A35', marginTop: 6, fontWeight: 600 }}>draining {v.kpiHiddenLoss}</div>
        </div>
      </div>

      {/* view switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={v.setWaterline} style={v.wlBtnStyle}><IconWaves size={16} sw={2} /> Waterline</button>
        <button onClick={v.setTriage} style={v.triBtnStyle}><IconRows /> Triage table</button>
        <button onClick={v.setLeak} style={v.leakBtnStyle}><IconBars /> Leak map</button>
        <button onClick={v.setAutopilot} style={v.apBtnStyle}><IconBolt size={16} /> Autopilot</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12.5, color: '#8B98A1' }}>Click any product for the full margin breakdown →</div>
      </div>

      {v.isWaterline && <WaterlineView v={v} />}
      {v.isTriage && <TriageView v={v} />}
      {v.isLeak && <LeakView v={v} />}
      {v.isAutopilot && <AutopilotView v={v} />}
    </>
  )
}
