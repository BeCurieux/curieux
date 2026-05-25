export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Basic origin check — only allow your own domain
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://curieux.co', 'https://www.curieux.co', 'https://curieux-ruddy.vercel.app' ,'http://localhost:5173'];
  if (!allowed.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages, system } = body;
  if (!messages || !system) {
    return new Response('Missing messages or system', { status: 400 });
  }

  // Proxy to Anthropic — API key never leaves the server
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      stream: true,
      system,
      messages,
    }),
  });

  if (!upstream.ok) {
    return new Response('Upstream API error', { status: upstream.status });
  }

  // Stream the SSE response directly back to the client
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': origin,
    },
  });
}

