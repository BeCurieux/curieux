import { IconCheck } from './Icons.jsx'

export default function Toast({ message }) {
  return (
    <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: '#16242E', color: '#fff', fontSize: 13.5, fontWeight: 600, padding: '13px 20px', borderRadius: 12, boxShadow: '0 12px 32px rgba(15,24,30,.3)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 11, animation: 'wlToast .3s ease both' }}>
      <IconCheck color="#1BB377" sw={2.4} size={18} />
      {message}
    </div>
  )
}
