import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthHash, jwtClaims, pickQuests, pickResult } from '../public/shared/cloud.mjs';
import { freshQuests } from '../public/shared/quests.mjs';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = c => `${b64({ alg: 'HS256' })}.${b64(c)}.sig`;

test('cloud: the sign-in address is read only when it is complete', () => {
  assert.deepEqual(parseAuthHash('#access_token=a.b.c&refresh_token=r&expires_in=3600&token_type=bearer'), { access: 'a.b.c', refresh: 'r', secs: 3600 });
  for (const h of ['', '#/dashboard', '#access_token=a', '#access_token=a&refresh_token=r', '#access_token=a&refresh_token=r&expires_in=0', null, 5]) assert.equal(parseAuthHash(h), null, String(h));
});

test('cloud: e-mail and user id come from the token, bad tokens give nothing', () => {
  assert.deepEqual(jwtClaims(jwt({ sub: 'u-1', email: 'a@b.kz' })), { id: 'u-1', email: 'a@b.kz' });
  assert.deepEqual(jwtClaims('not-a-token'), { id: '', email: '' });
  assert.deepEqual(jwtClaims(jwt({ sub: 5, email: {} })), { id: '', email: '' });
});

test('cloud: more XP wins, nothing is lost', () => {
  const mk = xp => ({ ...freshQuests(), xp });
  assert.deepEqual(pickQuests(mk(0), null), { use: 'local', push: false });
  assert.deepEqual(pickQuests(mk(40), null), { use: 'local', push: true });
  assert.deepEqual(pickQuests(mk(40), mk(10)), { use: 'local', push: true });
  assert.deepEqual(pickQuests(mk(10), mk(40)), { use: 'cloud', push: false });
  assert.deepEqual(pickQuests(mk(40), mk(40)), { use: 'cloud', push: false });
  assert.deepEqual(pickQuests(mk(40), { xp: 'x' }), { use: 'local', push: true });
});

test('cloud: a result is taken from the cloud only when this browser has none', () => {
  const a = { createdAt: '2026-11-17T01:00:00Z' }, b = { createdAt: '2026-11-17T02:00:00Z' };
  assert.equal(pickResult(null, a), 'pull');
  assert.equal(pickResult(a, null), 'push');
  assert.equal(pickResult(b, a), 'push');
  assert.equal(pickResult(a, a), 'none');
  assert.equal(pickResult(null, null), 'none');
});
