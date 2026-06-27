export const config = { runtime: 'edge' }

// Create a deposit Payment Intent (README §7 — Stripe AU). When
// STRIPE_SECRET_KEY is configured this hits the real Stripe API and returns a
// usable client secret for Stripe Elements. Without a key it returns a mock
// secret so the booking flow still completes end to end in demos.

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { amount, currency = 'aud', tripName = 'Charter deposit', customer = {} } = body
  if (!amount || amount <= 0) return new Response('Missing amount', { status: 400 })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    return Response.json({
      clientSecret: 'pi_mock_' + Math.random().toString(36).slice(2),
      mock: true,
    })
  }

  // Stripe expects the smallest currency unit (cents) and form-encoded bodies.
  const params = new URLSearchParams()
  params.set('amount', String(Math.round(amount * 100)))
  params.set('currency', currency)
  params.set('description', `${tripName} deposit`)
  params.set('automatic_payment_methods[enabled]', 'true')
  if (customer.email) params.set('receipt_email', customer.email)
  // GST is recorded for reporting; AU GST = 1/11 of a GST-inclusive amount.
  params.set('metadata[gst_aud]', String(Math.round((amount / 11) * 100) / 100))
  params.set('metadata[trip]', tripName)

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  }

  const intent = await res.json()
  return Response.json({ clientSecret: intent.client_secret, id: intent.id, mock: false })
}
