import Spark from '../Spark.jsx'
import { IconCheck, IconArrowRight, IconClock, IconInfo, IconChevronDown } from '../Icons.jsx'

export default function AutopilotView({ v }) {
  return (
    <>
      {/* control bar */}
      <div style={{ background: 'linear-gradient(108deg,#16242E,#1F3744)', borderRadius: 18, padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 24, marginBottom: 18, boxShadow: '0 10px 30px rgba(22,36,46,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div onClick={v.toggleAp} style={v.apSwitchTrack}><div style={v.apSwitchKnob} /></div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-.01em' }}>Autopilot is {v.apOnText}</div>
            <div style={{ fontSize: 12.5, color: '#AEBCC4', marginTop: 2, maxWidth: 340 }}>{v.apModeDesc}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,.08)', padding: 3, borderRadius: 10 }}>
          <button onClick={v.setModeGuarded} style={v.modeGuardStyle}>Guarded</button>
          <button onClick={v.setModeAsk} style={v.modeAskStyle}>Ask first</button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 700, color: '#1BB377', letterSpacing: '-.02em' }}>{v.recoveredText}</div>
          <div style={{ fontSize: 12, color: '#AEBCC4', marginTop: 1 }}>recovered this quarter · {v.runningCount} plays live</div>
        </div>
      </div>

      {/* impact ledger */}
      <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '20px 22px', marginBottom: 18, boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 15 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCheck color="#0E8F5E" /> Impact ledger
            </div>
            <div style={{ fontSize: 12.5, color: '#9AA7AE', marginTop: 2 }}>Proven before → after on every action Autopilot has taken. Reverse anything in one tap.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 21, fontWeight: 700, color: '#0E8F5E', letterSpacing: '-.01em' }}>{v.ledgerTotalText}</div>
            <div style={{ fontSize: 11, color: '#9AA7AE' }}>verified recovered · {v.ledgerCount} actions</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13 }}>
          {v.ledger.map((l) => (
            <div key={l.id} style={l.cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                <span style={l.typeStyle}>{l.type}</span>
                <span style={{ fontSize: 11, color: '#9AA7AE', marginLeft: 'auto' }}>{l.when}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#16242E', lineHeight: 1.4 }}>{l.action}</div>
              <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}><span style={l.dotStyle} />{l.productName}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '13px 0 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9.5, color: '#9AA7AE', fontWeight: 600 }}>BEFORE</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: '#C13A34' }}>{l.beforeTxt}</div>
                  </div>
                  <IconArrowRight />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9.5, color: '#9AA7AE', fontWeight: 600 }}>AFTER</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: l.afterColor }}>{l.afterTxt}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}><Spark series={l.chartSeries} color={l.chartColor} /></div>
              </div>

              <div style={{ fontSize: 11.5, color: '#6A7780', lineHeight: 1.45, marginTop: 6 }}>{l.note}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: '1px solid rgba(22,36,46,.07)' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: l.recoveredColor }}>{l.recoveredTxt}</div>
                <button onClick={l.revert} style={l.revertStyle}>{l.revertLabel}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* pending strip */}
      {v.hasPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F6ECD7', border: '1px solid rgba(168,119,15,.28)', borderRadius: 13, padding: '13px 18px', marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(168,119,15,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconClock />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, color: '#7A5A12', lineHeight: 1.45 }}><b>{v.pendingCount} plays are ready to run</b> — a projected <b>{v.pendingSumText}/mo</b> in additional recovered margin is waiting on you.</div>
          <button onClick={v.enableAll} style={{ background: '#A8770F', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 17px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>Enable all</button>
        </div>
      )}

      {/* columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* plays */}
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
          <div style={{ padding: '16px 22px 13px', fontSize: 15, fontWeight: 700, color: '#16242E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Automated plays
            <span style={{ fontSize: 12, fontWeight: 500, color: '#9AA7AE' }}>8 plays · 6 products</span>
          </div>
          {v.apPlays.map((p) => (
            <div key={p.id} style={{ borderTop: '1px solid rgba(22,36,46,.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 22px' }}>
                <span style={p.typeStyle}>{p.type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16242E' }}>{p.action}</div>
                  <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}><span style={p.dotStyle} />{p.productName} · {p.detail}</div>
                  <div onClick={p.expand} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 11.5, fontWeight: 700, color: '#3E7CA6', cursor: 'pointer' }}>
                    <IconInfo />
                    {p.whyLabel}
                    <span style={p.chevStyle}><IconChevronDown /></span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 96 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#0E8F5E', marginBottom: 5 }}>{p.amtText}</div>
                  <span style={p.pillStyle}>{p.pillText}</span>
                </div>
                <button onClick={p.toggle} style={p.btnStyle}>{p.btnLabel}</button>
              </div>
              {p.isOpen && (
                <div style={{ margin: '0 22px 16px', padding: '15px 17px', background: '#F7F9FA', border: '1px solid rgba(62,124,166,.16)', borderRadius: 13, animation: 'wlFadeUp .25s ease both' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#3E7CA6', marginBottom: 8 }}>WHY AUTOPILOT FLAGGED THIS</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#2C3A43' }}>{p.why}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#8B98A1', margin: '15px 0 9px' }}>SIGNALS IT READ</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {p.signals.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', borderRadius: 9, padding: '8px 11px' }}>
                        <div style={s.barStyle} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: '#8B98A1', fontWeight: 500 }}>{s.label}</div>
                          <div style={s.valStyle}>{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E', marginBottom: 15 }}>Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {v.activity.map((a, i) => (
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
          <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Guardrails</div>
            <div style={{ fontSize: 12, color: '#9AA7AE', marginTop: 2, marginBottom: 15 }}>Autopilot will never cross these lines.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {v.guardrails.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div onClick={g.toggle} style={g.trackStyle}><div style={g.knobStyle} /></div>
                  <span style={{ fontSize: 12.5, color: '#2C3A43', lineHeight: 1.35, flex: 1 }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
