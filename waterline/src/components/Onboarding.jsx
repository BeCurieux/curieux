import { Logo, IconX, IconCheck, IconBolt, IconLock } from './Icons.jsx'

export default function Onboarding({ v }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,24,30,.5)', backdropFilter: 'blur(3px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, animation: 'wlBackdrop .25s ease both' }}>
      <div style={{ width: 720, maxWidth: '100%', maxHeight: '92vh', background: '#F6F4EE', borderRadius: 20, boxShadow: '0 30px 80px rgba(15,24,30,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'wlDrawerIn .3s cubic-bezier(.22,1,.36,1) both' }}>
        {/* header + progress */}
        <div style={{ padding: '22px 28px 18px', background: '#fff', borderBottom: '1px solid rgba(22,36,46,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Logo size={30} radius={8} />
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16242E' }}>Set up Waterline</div>
            </div>
            <button onClick={v.closeOnboarding} style={{ background: '#F1EFE9', border: 'none', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6A7780' }}>
              <IconX size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {v.obProgress.map((st) => (
              <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={st.dotStyle}>{st.num}</div>
                <div style={st.labelStyle}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {v.obStepIs0 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#16242E', letterSpacing: '-.01em' }}>Connect your Shopify store</div>
              <div style={{ fontSize: 13.5, color: '#6A7780', marginTop: 5, lineHeight: 1.5, maxWidth: 520 }}>Waterline reads your orders, products, refunds, and the cost-per-item field. Read-only — it never changes anything until you turn on Autopilot.</div>
              <div style={{ marginTop: 22, background: '#fff', border: '1px solid rgba(22,36,46,.08)', borderRadius: 14, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#95BF47', color: '#16242E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>S</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16242E' }}>Shopify</div>
                    <div style={{ fontSize: 12, color: '#9AA7AE' }}>harborandvine.myshopify.com</div>
                  </div>
                </div>
                <button onClick={v.obConnectShopify} style={v.obShopifyBtnStyle}>{v.obShopifyBtnText}</button>
              </div>
            </>
          )}
          {v.obStepIs1 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#16242E', letterSpacing: '-.01em' }}>Connect your ad spend</div>
              <div style={{ fontSize: 13.5, color: '#6A7780', marginTop: 5, lineHeight: 1.5, maxWidth: 520 }}>This is where the hidden losses live. Connecting ad platforms lets Waterline allocate real spend per product — the difference between "profit" and "true profit." Optional, but margins are guesswork without it.</div>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {v.adPlatforms.map((a) => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid rgba(22,36,46,.08)', borderRadius: 13, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={a.iconStyle}>{a.icon}</div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#16242E' }}>{a.name}</div>
                    {a.connected ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0E7A50', fontSize: 13, fontWeight: 700 }}><IconCheck color="currentColor" sw={2.4} size={16} />Connected</span>
                    ) : (
                      <button onClick={a.connect} style={{ background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '8px 16px', borderRadius: 9, cursor: 'pointer' }}>Connect</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {v.obStepIs2 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#16242E', letterSpacing: '-.01em' }}>How should we get your product costs?</div>
              <div style={{ fontSize: 13.5, color: '#6A7780', marginTop: 5, lineHeight: 1.5, maxWidth: 520 }}>Cost of goods is the foundation of every margin. Pick the source that matches where your numbers already live.</div>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {v.cogsOptions.map((o) => (
                  <div key={o.id} onClick={o.pick} style={o.cardStyle}>
                    <div style={o.radioStyle}><div style={o.radioDot} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#16242E' }}>{o.t}</div>
                      <div style={{ fontSize: 12.5, color: '#6A7780', marginTop: 3, lineHeight: 1.45 }}>{o.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {v.obStepIs3 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#16242E', letterSpacing: '-.01em' }}>How much should Autopilot do?</div>
              <div style={{ fontSize: 13.5, color: '#6A7780', marginTop: 5, lineHeight: 1.5, maxWidth: 520 }}>Waterline can simply alert you, or it can act within strict guardrails and prove the result. You can change this anytime.</div>
              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                <div style={{ background: '#fff', border: '2px solid rgba(22,36,46,.1)', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#16242E' }}>Alert me only</div>
                  <div style={{ fontSize: 12.5, color: '#6A7780', marginTop: 6, lineHeight: 1.5 }}>Waterline finds the leaks and tells you. You make every change yourself.</div>
                </div>
                <div style={{ background: '#16242E', border: '2px solid #16242E', borderRadius: 14, padding: 18, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 12, right: 12, background: '#1BB377', color: '#06231A', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>RECOMMENDED</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}><IconBolt fill="#1BB377" size={15} />Guarded Autopilot</div>
                  <div style={{ fontSize: 12.5, color: '#AEBCC4', marginTop: 6, lineHeight: 1.5 }}>Acts automatically inside your guardrails, holds big moves for approval, and logs every result.</div>
                </div>
              </div>
              <div style={{ marginTop: 14, background: '#EEF5F1', border: '1px solid rgba(14,143,94,.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}><IconLock /></span>
                <div style={{ fontSize: 12.5, color: '#2C4A3E', lineHeight: 1.5 }}>Default guardrails are on: never pause ads above 20% margin, cap discounts at 10%, and require your approval above $5,000 impact.</div>
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '18px 28px', background: '#fff', borderTop: '1px solid rgba(22,36,46,.08)', display: 'flex', gap: 11, alignItems: 'center' }}>
          {v.obShowBack && (
            <button onClick={v.obBack} style={{ background: '#F1EFE9', color: '#6A7780', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: '13px 20px', borderRadius: 11, cursor: 'pointer' }}>Back</button>
          )}
          {v.obStepIs3 ? (
            <button onClick={v.obFinish} style={{ flex: 1, background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 13, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IconBolt fill="#1BB377" size={16} />Finish &amp; start watching</button>
          ) : (
            <button onClick={v.obNextDisabled ? undefined : v.obNext} style={v.obPrimaryStyle}>Continue</button>
          )}
        </div>
      </div>
    </div>
  )
}
