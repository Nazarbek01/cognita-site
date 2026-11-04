// Talks to the Netlify functions. Every call has a time limit and returns plain results or throws a short message.

async function call(path, init, ms) {
  if (window.COGNITA_DEMO) { const err = new Error('This demo has no server.'); err.status = 0; throw err; }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(path, { ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json' } });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok || !data || data.ok === false) {
      const err = new Error((data && data.error) || `Server answered ${res.status}.`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') { const err = new Error('The server took too long to answer.'); err.status = 0; throw err; }
    if (e.status === undefined) e.status = 0;     // network failure
    throw e;
  } finally { clearTimeout(t); }
}

export const match = body => call('/api/match', { method: 'POST', body: JSON.stringify(body) }, 40000);
export const loadResult = code => call('/api/result?code=' + encodeURIComponent(code), { method: 'GET' }, 15000);
export const sendFeedback = body => call('/api/feedback', { method: 'POST', body: JSON.stringify(body) }, 15000);
