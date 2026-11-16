// Pure helpers for the optional Google sign-in and cloud sync (no browser calls here, so they can be tested).

/** Read the tokens Supabase puts after the # when it sends the person back. Returns null if the address has none. */
export function parseAuthHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#access_token=')) return null;
  const p = new URLSearchParams(hash.slice(1));
  const access = p.get('access_token'), refresh = p.get('refresh_token'), secs = Number(p.get('expires_in'));
  if (!access || !refresh || !(secs > 0)) return null;
  return { access, refresh, secs };
}

/** The readable part of a token (e-mail and user id). We only read it to show who is signed in; the server checks it. */
export function jwtClaims(token) {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(part) : Buffer.from(part, 'base64').toString('utf8');
    const c = JSON.parse(json);
    return { id: typeof c.sub === 'string' ? c.sub : '', email: typeof c.email === 'string' ? c.email : '' };
  } catch { return { id: '', email: '' }; }
}

/** Which quest progress wins after signing in: the one with more XP. Nothing is ever lost silently, equal XP keeps the cloud copy. */
export function pickQuests(local, cloud) {
  const ok = q => q && typeof q === 'object' && typeof q.xp === 'number' && Array.isArray(q.list);
  if (!ok(cloud)) return { use: 'local', push: ok(local) && local.xp > 0 };
  if (!ok(local) || cloud.xp >= local.xp) return { use: 'cloud', push: false };
  return { use: 'local', push: true };
}

/** Result sync: take the cloud result only when this browser has none; push a local one the cloud does not have yet. */
export function pickResult(local, cloud) {
  if (!local && cloud) return 'pull';
  if (local && (!cloud || cloud.createdAt !== local.createdAt)) return 'push';
  return 'none';
}
