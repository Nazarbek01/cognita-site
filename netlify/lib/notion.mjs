// Saves results and feedback to Notion and reads a result back by its private code.
// Needs NOTION_TOKEN (internal integration), NOTION_RESULTS_DB and NOTION_FEEDBACK_DB.
// The column names below must match the databases in the "Cognita: данные сайта" page.

import { randomInt } from 'node:crypto';
import { fetchTimeout } from './http.mjs';
import { FIELD_BY_ID } from '../../public/shared/careers.mjs';
import { GOALS } from '../../public/shared/config.mjs';

const VERSION = '2022-06-28';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L

/** COG-XXXX-XXXX-XXXX: 12 random characters, about 59 bits. Unguessable in practice. */
export function makeCode(rand = randomInt) {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[rand(ALPHABET.length)]).join('');
  return `COG-${part()}-${part()}-${part()}`;
}
export const CODE_RE = /^COG-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

const text = (s, max = 2000) => {
  const str = String(s == null ? '' : s);
  const parts = [];
  for (let i = 0; i < str.length && parts.length < 100; i += max) parts.push({ type: 'text', text: { content: str.slice(i, i + max) } });
  return { rich_text: parts };
};
const plain = prop => (prop && prop.rich_text ? prop.rich_text.map(t => t.plain_text).join('') : '');

export const notionReady = env => !!(env.NOTION_TOKEN && env.NOTION_RESULTS_DB && env.NOTION_FEEDBACK_DB);

async function call(env, fetchFn, path, method, body) {
  const base = (env.NOTION_BASE_URL || 'https://api.notion.com').replace(/\/+$/, '');
  const res = await fetchTimeout(fetchFn, base + path, {
    method,
    headers: { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }, Number(env.NOTION_TIMEOUT_MS) || 6000);
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).message || ''; } catch { /* ignore */ }
    throw new Error(`Notion answered ${res.status}. ${String(msg).slice(0, 160)}`);
  }
  return res.json();
}

// The results database was made for students ("Grade", "Subjects"). For the professional path the same
// columns hold the work details, so the database needs no new columns.
const isPro = p => p && p.mode === 'pro';
const who = p => (isPro(p) ? `Professional · ${p.exp} · ${p.edu}` : p.grade);
const background = p => (isPro(p)
  ? `Field: ${p.field === 'other' ? 'Other' : FIELD_BY_ID[p.field].name} · Goal: ${GOALS.find(g => g.id === p.goal).name}`
  : p.subjects.join(', '));

/** Store one finished result. Returns the private code. No name, e-mail or free text is stored. */
export async function saveResult(env, fetchFn, { result, answers, consent }) {
  const code = makeCode();
  const top = result.matches[0];
  const props = {
    'Result code': { title: [{ type: 'text', text: { content: code } }] },
    'Top career': text(top.id),
    'Top match': { number: top.match },
    'Source': { select: { name: result.source === 'ai' ? 'AI' : 'Rules fallback' } },
    'Grade': text(who(result.profile)),
    'Subjects': text(background(result.profile)),
    'Skills': text(result.profile.skills.join(', ')),
    'Answers': text(answers.join('')),
    'Area scores': text(JSON.stringify(result.areas)),
    'Result JSON': text(JSON.stringify(result)),
    'Catalogue version': { number: result.catalogueVersion },
    'Consent': { checkbox: !!consent },
  };
  await call(env, fetchFn, '/v1/pages', 'POST', { parent: { database_id: env.NOTION_RESULTS_DB }, properties: props });
  return code;
}

/** Read a saved result by its code. Returns { result, answers } or null. */
export async function loadResult(env, fetchFn, code) {
  const data = await call(env, fetchFn, `/v1/databases/${env.NOTION_RESULTS_DB}/query`, 'POST', {
    filter: { property: 'Result code', title: { equals: code } },
    page_size: 1,
  });
  const page = data.results && data.results[0];
  if (!page) return null;
  try {
    const result = JSON.parse(plain(page.properties['Result JSON']));
    const a = plain(page.properties['Answers']);
    const answers = /^[0-4]{30}$/.test(a) ? a.split('').map(Number) : null;
    return { result, answers };
  } catch { return null; }
}

export async function saveFeedback(env, fetchFn, { code, rating, career, comment }) {
  const props = {
    'Result code': { title: [{ type: 'text', text: { content: code } }] },
    'Rating': { number: rating },
    'Career': text(career || ''),
    'Comment': text(comment || ''),
  };
  await call(env, fetchFn, '/v1/pages', 'POST', { parent: { database_id: env.NOTION_FEEDBACK_DB }, properties: props });
}
