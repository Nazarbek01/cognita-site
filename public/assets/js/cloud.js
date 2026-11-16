// Optional Google sign-in and cloud sync. The site works the same without it.
// Sign-in goes through Supabase. The tokens stay in this browser; every table is limited to its owner (Row Level Security).

import { SITE } from './site.config.js';
import { parseAuthHash, jwtClaims, pickQuests, pickResult } from '../../shared/cloud.mjs';
import { looksLikeResult } from '../../shared/engine.mjs';

const KEY = 'cognita.auth';
const { url: BASE, key: APIKEY } = SITE.supabase || {};
const now = () => Math.floor(Date.now() / 1000);

let sess = null;
try { sess = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { sess = null; }
if (sess && !(sess.access && sess.refresh && sess.id)) sess = null;
const keep = () => { try { if (sess) localStorage.setItem(KEY, JSON.stringify(sess)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };
const fail = (msg, status = 0) => Object.assign(new Error(msg), { status });

export const enabled = () => !!(BASE && APIKEY) && !window.COGNITA_DEMO;
export const user = () => (sess ? { email: sess.email, id: sess.id } : null);

/** Call once at start: if Google just sent the person back, keep the session and clean the address. */
export function takeRedirect() {
  if (!enabled()) return false;
  const t = parseAuthHash(location.hash);
  if (!t) return false;
  const c = jwtClaims(t.access);
  if (!c.id) return false;
  sess = { access: t.access, refresh: t.refresh, exp: now() + t.secs, id: c.id, email: c.email };
  keep();
  history.replaceState(null, '', location.pathname + location.search + '#/account');
  return true;
}

export function signIn() {
  if (!enabled()) return;
  location.href = `${BASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin + '/')}`;
}

export function signOut() { sess = null; keep(); }

async function raw(path, init = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    return await fetch(BASE + path, { ...init, signal: ctl.signal, headers: { apikey: APIKEY, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  } catch (e) { throw fail(e.name === 'AbortError' ? 'The server took too long to answer.' : 'Could not reach the cloud. Check your connection.'); }
  finally { clearTimeout(t); }
}

async function fresh() {
  if (!sess) throw fail('Not signed in.', 401);
  if (sess.exp - 60 > now()) return;
  const res = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: sess.refresh }) });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d || !d.access_token) { signOut(); throw fail('Your sign-in expired. Please sign in again.', 401); }
  const c = jwtClaims(d.access_token);
  sess = { access: d.access_token, refresh: d.refresh_token || sess.refresh, exp: now() + (Number(d.expires_in) || 3600), id: c.id || sess.id, email: c.email || sess.email };
  keep();
}

async function rest(path, init = {}) {
  await fresh();
  const res = await raw('/rest/v1/' + path, { ...init, headers: { Authorization: 'Bearer ' + sess.access, ...(init.headers || {}) } });
  if (res.status === 401) { signOut(); throw fail('Your sign-in expired. Please sign in again.', 401); }
  if (!res.ok) throw fail('The cloud could not save this. Try again later.', res.status);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const up = { headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } };

export const pushQuests = quests => rest('quest_state?on_conflict=user_id', { method: 'POST', ...up, body: JSON.stringify({ user_id: sess.id, state: quests, updated_at: new Date().toISOString() }) });

/** Store the latest result once (the same result is never written twice). */
async function pushResult(r, code) {
  await rest('results', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: sess.id, code: code || null, result: r, answers: r.answers || null }) });
}

/**
 * Sync after sign-in. Returns { quests?, result?, answers?, code? } to apply locally.
 * Rule: more XP wins for quests; a result is taken from the cloud only when this browser has none.
 */
export async function sync(S) {
  await fresh();
  await rest('profiles?on_conflict=id', { method: 'POST', ...up, body: JSON.stringify({ id: sess.id, mode: S.profile && S.profile.mode === 'pro' ? 'pro' : 'student' }) });
  const [qs, rs] = await Promise.all([
    rest('quest_state?select=state&limit=1'),
    rest('results?select=result,code,created_at&order=created_at.desc&limit=1'),
  ]);
  const out = {};
  const q = pickQuests(S.quests, qs && qs[0] && qs[0].state);
  if (q.use === 'cloud') out.quests = qs[0].state;
  else if (q.push) await pushQuests(S.quests);
  const cloudRes = rs && rs[0] && looksLikeResult(rs[0].result) ? rs[0].result : null;
  const act = pickResult(S.result, cloudRes);
  if (act === 'pull') { out.result = cloudRes; out.answers = Array.isArray(cloudRes.answers) ? cloudRes.answers : null; out.code = rs[0].code || null; }
  else if (act === 'push') await pushResult(S.result, S.code);
  return out;
}

/** Delete everything this person has in the cloud (their own rows only). */
export async function wipeCloud() {
  await fresh();
  for (const [t, col] of [['results', 'user_id'], ['quest_state', 'user_id'], ['profiles', 'id']]) {
    await rest(`${t}?${col}=eq.${encodeURIComponent(sess.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
}
