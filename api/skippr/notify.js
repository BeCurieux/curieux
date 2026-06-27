export const config = { runtime: 'edge' }

// Outbound messaging (README §7 — Twilio/MessageMedia SMS, Postmark/SendGrid
// email). Sends for real when the relevant credentials are present; otherwise
// returns { mock: true } so the captain's activity log still records the
// message that would have gone out (confirmations, rebooking links, reviews).

async function sendSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !token || !from) return { mock: true }

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  return { mock: false, ok: res.ok }
}

async function sendEmail({ to, subject, body }) {
  const token = process.env.POSTMARK_TOKEN
  const from = process.env.POSTMARK_FROM
  if (!token || !from) return { mock: true }

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: body }),
  })
  return { mock: false, ok: res.ok }
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let msg
  try {
    msg = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { channel, to, subject = '', body = '' } = msg
  if (!channel || !to) return new Response('Missing channel or to', { status: 400 })

  try {
    const result = channel === 'sms' ? await sendSms({ to, body }) : await sendEmail({ to, subject, body })
    return Response.json({ ok: true, ...result })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
