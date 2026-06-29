// Shared inline-style builders ported from the prototype's renderVals().

export const card = {
  background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: '18px',
  boxShadow: '0 1px 2px rgba(22,36,46,.04)',
}

// Range segmented control buttons (topbar).
export const segR = (active) => ({
  padding: '6px 14px', fontSize: '12.5px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
  border: 'none', fontFamily: 'inherit', transition: 'all .15s',
  background: active ? '#16242E' : 'transparent', color: active ? '#fff' : '#6A7780',
  boxShadow: active ? '0 1px 3px rgba(22,36,46,.2)' : 'none',
})

// View switcher pills (Waterline / Triage / Leak / Autopilot).
export const segV = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '13.5px',
  fontWeight: 600, borderRadius: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
  border: '1px solid ' + (active ? '#16242E' : 'rgba(22,36,46,.12)'),
  background: active ? '#16242E' : '#fff', color: active ? '#fff' : '#5A6770',
})

// Dark-track segmented control (Autopilot Guarded / Ask first).
export const segD = (active) => ({
  padding: '6px 15px', fontSize: '12.5px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
  border: 'none', fontFamily: 'inherit', transition: 'all .15s',
  background: active ? '#fff' : 'transparent', color: active ? '#16242E' : '#AEBCC4',
})

export const navItem = (active) => ({
  display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px', fontSize: '13.5px',
  fontWeight: active ? 600 : 500, color: active ? '#fff' : '#9AAAB2',
  background: active ? 'rgba(27,179,119,0.14)' : 'transparent', cursor: 'pointer', position: 'relative',
})

export const navRail = (active) => ({
  position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '3px', borderRadius: '3px',
  background: active ? '#1BB377' : 'transparent',
})

// Toggle switch (guardrails, alert rules).
export const switchTrack = (on) => ({
  width: '36px', height: '21px', borderRadius: '20px', background: on ? '#0E8F5E' : '#CFCBC1',
  position: 'relative', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
})
export const switchKnob = (on) => ({
  position: 'absolute', top: '2px', left: on ? '17px' : '2px', width: '17px', height: '17px', borderRadius: '50%',
  background: '#fff', transition: 'all .15s', boxShadow: '0 1px 2px rgba(0,0,0,.22)',
})

export const darkBtn = { background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 700, padding: '8px 15px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }
export const greyBtn = { background: '#F1EFE9', color: '#8B98A1', border: 'none', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '8px 15px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }
export const heldBtn = { background: '#F1EFE9', color: '#B6BDB4', border: 'none', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '8px 15px', borderRadius: '9px', cursor: 'not-allowed', whiteSpace: 'nowrap' }
export const stepBtn = { width: '24px', height: '24px', borderRadius: '7px', border: '1px solid rgba(22,36,46,.14)', background: '#fff', color: '#6A7780', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }
