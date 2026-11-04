// Small helpers shared by all functions: JSON responses, body reading, rate limit, safe fetch with timeout.

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });

export const fail = (status, message, extra = {}) => json({ ok: false, error: message, ...extra }, status);

/** Read a JSON body, refusing anything bigger than maxBytes. */
export async function readJson(req, maxBytes = 20000) {
  const text = await req.text();
  if (text.length > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error('Request body is not valid JSON.'), { status: 400 }); }
}

/** fetch() that gives up after ms milliseconds. */
export async function fetchTimeout(fetchFn, url, init, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetchFn(url, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

/**
 * Best-effort rate limit kept in memory.
 * Serverless instances come and go, so this slows down careless abuse but is not a hard guarantee.
 * The real spending limit is the one you set in your OpenAI account.
 */
const buckets = new Map();
export function rateLimit(key, max, windowMs, now = Date.now()) {
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  return b.n <= max;
}
export const _resetRateLimit = () => buckets.clear();

export function clientIp(req) {
  const h = req.headers;
  return (h.get('x-nf-client-connection-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
}

/** Same-origin check for browser POSTs: blocks other websites from using your AI budget from a visitor's browser. */
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;                       // curl, tests, same-origin GET
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  try { return new URL(origin).host === host; } catch { return false; }
}
