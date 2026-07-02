const GRID = '0.8fr 1.4fr 1.6fr 2.4fr 0.9fr 1fr 1fr'

export default function OrdersScreen({ v }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
      <div style={{ padding: '16px 24px 13px', fontSize: 15, fontWeight: 700, color: '#16242E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Recent orders
        <span style={{ fontSize: 12, fontWeight: 500, color: '#9AA7AE' }}>{v.ordersCount} orders</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 24px', background: '#FAF9F5', borderTop: '1px solid rgba(22,36,46,.06)', borderBottom: '1px solid rgba(22,36,46,.08)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#8B98A1', textTransform: 'uppercase' }}>
        <div>Order</div><div>When</div><div>Customer</div><div>Items</div><div style={{ textAlign: 'right' }}>Qty</div><div style={{ textAlign: 'right' }}>Total</div><div style={{ textAlign: 'right' }}>Status</div>
      </div>
      {v.orders.map((o) => (
        <div key={o.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '13px 24px', borderBottom: '1px solid rgba(22,36,46,.05)', alignItems: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: '#16242E' }}>#{o.id}</div>
          <div style={{ fontSize: 12.5, color: '#6A7780' }}>{o.when}</div>
          <div style={{ fontSize: 13, color: '#16242E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer}</div>
          <div style={{ fontSize: 12.5, color: '#6A7780', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.lines}</div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#6A7780' }}>{o.items}</div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#16242E' }}>{o.totalText}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={o.pillStyle}>{o.pillText}</span></div>
        </div>
      ))}
    </div>
  )
}
