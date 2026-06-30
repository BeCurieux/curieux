import { T } from '../lib/styles.js'
import { IconCheckSmall } from './Icons.jsx'

export default function Toast({ message }) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10, background: T.dark, color: '#fff',
        padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
        boxShadow: '0 12px 30px -10px rgba(42,36,32,.5)', zIndex: 50, animation: 'ltToast .25s ease both',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <IconCheckSmall color="#fff" />
      </span>
      {message}
    </div>
  )
}
