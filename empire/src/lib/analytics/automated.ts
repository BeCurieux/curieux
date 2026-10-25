// Visits from machines, not people: Vercel's checks after each deployment
// (screenshots, favicons), search and link-preview crawlers, and headless
// browsers. Their page views would otherwise count as visitors in /admin.
// Matching is on the User-Agent header only; a bot that pretends to be a
// browser still gets counted.

const AUTOMATED =
  /vercel|headlesschrome|lighthouse|pagespeed|bot\b|bot\/|crawler|spider|slurp|facebookexternalhit|preview|curl\/|wget\/|python-requests|node-fetch|undici/i;

export function isAutomatedVisitor(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return true;
  return AUTOMATED.test(userAgent);
}
