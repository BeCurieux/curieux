import { Logo, IconGrid, IconWaves, IconBolt, IconBox, IconList, IconCoin, IconBell, IconCard, IconGear } from './Icons.jsx'

export default function Sidebar({ v }) {
  return (
    <aside style={{ width: 232, flexShrink: 0, background: '#16242E', color: '#C5D0D6', display: 'flex', flexDirection: 'column', padding: '22px 16px 18px' }}>
      {/* logo lockup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px 4px' }}>
        <Logo />
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: '#fff', letterSpacing: '-.01em' }}>Waterline</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7E8E97', letterSpacing: '.06em', marginTop: 3 }}>MARGIN INTELLIGENCE</div>
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', color: '#5E6E78', margin: '24px 8px 8px' }}>WORKSPACE</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="wl-nav" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, color: '#9AAAB2', cursor: 'pointer' }}>
          <IconGrid /> Overview
        </div>
        <div onClick={v.goMargins} style={v.navMargins}>
          <div style={v.navMarginsRail} />
          <IconWaves color="#1BB377" /> Margins
        </div>
        <div onClick={v.goAutopilot} className="wl-nav" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, color: '#9AAAB2', cursor: 'pointer' }}>
          <IconBolt /> <span style={{ flex: 1 }}>Autopilot</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#1BB377' }}>
            {v.apOnText}
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1BB377', boxShadow: '0 0 0 3px rgba(27,179,119,.18)' }} />
          </span>
        </div>
        <div className="wl-nav" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, color: '#9AAAB2', cursor: 'pointer' }}>
          <IconBox /> Products
        </div>
        <div className="wl-nav" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, color: '#9AAAB2', cursor: 'pointer' }}>
          <IconList /> Orders
        </div>
        <div onClick={v.goCosts} style={v.navCosts}>
          <div style={v.navCostsRail} />
          <IconCoin /> <span style={{ flex: 1 }}>Cost inputs</span>
          {v.hasMissingCosts && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D6453F' }} />}
        </div>
        <div onClick={v.goAlerts} style={v.navAlerts}>
          <div style={v.navAlertsRail} />
          <IconBell /> <span style={{ flex: 1 }}>Alerts</span>
          <span style={{ background: '#D6453F', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{v.liveAlertCount}</span>
        </div>
      </nav>

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', color: '#5E6E78', margin: '22px 8px 8px' }}>ACCOUNT</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div onClick={v.goPlans} style={v.navPlans}>
          <div style={v.navPlansRail} />
          <IconCard /> <span style={{ flex: 1 }}>Plans &amp; billing</span>
        </div>
      </nav>

      <div style={{ flex: 1 }} />

      {/* store card */}
      <div onClick={v.openOnboarding} className="wl-store" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '13px 14px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#6B8E4E,#4A6B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>H</div>
          <div style={{ minWidth: 0, lineHeight: 1.2, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Harbor &amp; Vine</div>
            <div style={{ fontSize: 11, color: '#7E8E97' }}>harborandvine.com</div>
          </div>
          <IconGear color="#7E8E97" size={15} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1BB377', boxShadow: '0 0 0 3px rgba(27,179,119,.18)' }} />
          <span style={{ fontSize: 11, color: '#9AAAB2', fontWeight: 500 }}>Synced 4 min ago · Shopify</span>
        </div>
      </div>
    </aside>
  )
}
