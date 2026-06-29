import Waterfall from './Waterfall.jsx'
import { IconX, IconSparkles, IconBolt } from './Icons.jsx'

export default function Drawer({ v }) {
  const sel = v.sel
  return (
    <>
      <div onClick={v.closeDrawer} style={{ position: 'absolute', inset: 0, background: 'rgba(15,24,30,.34)', backdropFilter: 'blur(2px)', zIndex: 40, animation: 'wlBackdrop .25s ease both' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, background: '#F6F4EE', zIndex: 41, boxShadow: '-14px 0 44px rgba(15,24,30,.22)', display: 'flex', flexDirection: 'column', animation: 'wlDrawerIn .3s cubic-bezier(.22,1,.36,1) both' }}>
        {/* header */}
        <div style={{ padding: '22px 26px 18px', background: '#fff', borderBottom: '1px solid rgba(22,36,46,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={sel.dotStyleLg} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#16242E', letterSpacing: '-.01em' }}>{sel.name}</div>
                <div style={{ fontSize: 12.5, color: '#9AA7AE' }}>{sel.cat} · {sel.unitsText} units · {v.rangeLabel}</div>
              </div>
            </div>
            <button onClick={v.closeDrawer} style={{ background: '#F1EFE9', border: 'none', borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6A7780' }}>
              <IconX size={17} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ flex: 1, background: '#F6F4EE', borderRadius: 11, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, color: '#8B98A1', fontWeight: 600 }}>Net profit</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700, color: sel.netColor, marginTop: 3 }}>{sel.netText}</div>
            </div>
            <div style={{ flex: 1, background: '#F6F4EE', borderRadius: 11, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, color: '#8B98A1', fontWeight: 600 }}>Margin</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700, color: sel.netColor, marginTop: 3 }}>{sel.pctText}</div>
            </div>
            <div style={{ flex: 1, background: '#F6F4EE', borderRadius: 11, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, color: '#8B98A1', fontWeight: 600 }}>Per unit</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700, color: '#16242E', marginTop: 3 }}>{sel.perUnitText}</div>
            </div>
            <div style={{ flex: 1, background: '#F6F4EE', borderRadius: 11, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, color: '#8B98A1', fontWeight: 600 }}>Ad ROAS</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700, color: sel.roasColor, marginTop: 3 }}>{sel.roasText}</div>
            </div>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 26px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#16242E', marginBottom: 2 }}>Margin breakdown</div>
          <div style={{ fontSize: 12, color: '#9AA7AE', marginBottom: 6 }}>From price to pocket, per {v.rangeLabel}.</div>
          <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 14, padding: '18px 16px 10px' }}>
            <Waterfall steps={v.selSteps} zeroStyle={v.selZeroStyle} height={248} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#16242E', margin: '24px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSparkles /> {sel.fixHeader}
          </div>

          {sel.hasPlays && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sel.plays.map((p) => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 13, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#16242E', lineHeight: 1.4 }}>{p.action}</div>
                    <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 3 }}>{p.detail}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
                      <span style={p.pillStyle}>{p.pillText}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, color: '#0E7A50' }}>{p.amtText}</span>
                    </div>
                  </div>
                  <button onClick={p.toggle} style={p.btnStyle}>{p.btnLabel}</button>
                </div>
              ))}
            </div>
          )}
          {sel.noPlays && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sel.recs.map((r, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 13, padding: '14px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0E8F5E', marginTop: 6, flexShrink: 0, boxShadow: '0 0 0 4px rgba(14,143,94,.13)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: '#2C3A43' }}>{r.t}</div>
                    <div style={{ display: 'inline-block', marginTop: 8, background: '#E4F3EB', color: '#0E7A50', fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace" }}>{r.i}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '16px 26px', background: '#fff', borderTop: '1px solid rgba(22,36,46,.08)', display: 'flex', gap: 10 }}>
          <button onClick={v.applyFix} style={{ flex: 1, background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: 12, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IconBolt fill="#1BB377" size={16} />Hand off to Autopilot</button>
          <button onClick={v.snoozeFix} style={{ background: '#F1EFE9', color: '#6A7780', border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '12px 18px', borderRadius: 11, cursor: 'pointer' }}>Snooze</button>
        </div>
      </div>
    </>
  )
}
