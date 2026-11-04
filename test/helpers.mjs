// Fakes for OpenAI and Notion, used by the tests and by the browser test.

import { CAREERS } from '../public/shared/careers.mjs';

export const ENV = {
  OPENAI_API_KEY: 'sk-test-SECRET-123',
  NOTION_TOKEN: 'secret_notion_TOKEN',
  NOTION_RESULTS_DB: 'a'.repeat(32),
  NOTION_FEEDBACK_DB: 'b'.repeat(32),
  RATE_LIMIT_MAX: '1000',
};

export const goodInput = (over = {}) => ({
  answers: Array.from({ length: 30 }, (_, i) => (i % 6 === 0 ? 4 : i % 6 === 1 ? 3 : 1)),
  profile: { grade: '11', subjects: ['Mathematics', 'Informatics'], skills: ['excel', 'logic'] },
  note: '',
  useAi: true,
  save: true,
  ...over,
});

/** A reasonable AI answer: top careers by baseline, with a +3 shift on the first one. */
export function fakeAiAnswer(payload, { shift = 3, tweak } = {}) {
  const careers = [...payload.careers].sort((a, b) => b.baseline_match - a.baseline_match).slice(0, 5);
  const matches = careers.map((c, i) => ({
    id: c.id,
    match: c.baseline_match + (i === 0 ? shift : 0),
    summary: `You have strong scores that fit ${c.name}.`,
    build: c.core_skills.map(s => s.id).filter(id => !payload.student.skills_already_have.includes(id)).slice(0, 2),
  }));
  return tweak ? tweak({ matches }) : { matches };
}

/**
 * Fake fetch that behaves like OpenAI + Notion.
 * opts.ai: 'ok' | 'garbage' | 'http500' | 'timeout' | 'refusal' | 'xss' | function(payload)->object
 * opts.notion: 'ok' | 'down'
 */
export function makeFetch(opts = {}) {
  const store = new Map();         // code -> page properties
  const log = { openai: [], notion: [] };
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.includes('/chat/completions')) {
      const body = JSON.parse(init.body);
      log.openai.push({ url: u, headers: init.headers, body });
      const mode = opts.ai || 'ok';
      if (mode === 'timeout') { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
      if (mode === 'http500') return reply(500, { error: { message: 'server error' } });
      if (mode === 'refusal') return reply(200, { choices: [{ message: { refusal: 'no', content: null } }] });
      if (mode === 'garbage') return reply(200, { choices: [{ message: { content: 'not json at all' } }] });
      const payload = JSON.parse(body.messages[1].content);
      const answer = typeof mode === 'function' ? mode(payload)
        : mode === 'xss' ? fakeAiAnswer(payload, { tweak: a => ({ matches: a.matches.map(m => ({ ...m, summary: '<img src=x onerror="window.__xss=1">Fits you <b>well</b>' })) }) })
        : fakeAiAnswer(payload);
      return reply(200, { choices: [{ message: { content: JSON.stringify(answer) } }] });
    }
    if (u.includes('/v1/pages')) {
      const body = JSON.parse(init.body);
      log.notion.push({ url: u, body });
      if (opts.notion === 'down') return reply(500, { message: 'boom' });
      store.set(body.parent.database_id + ':' + body.properties['Result code'].title[0].text.content, { db: body.parent.database_id, properties: body.properties });
      return reply(200, { id: 'page-id' });
    }
    if (u.includes('/query')) {
      log.notion.push({ url: u, body: JSON.parse(init.body) });
      if (opts.notion === 'down') return reply(500, { message: 'boom' });
      const code = JSON.parse(init.body).filter.title.equals;
      const db = (u.match(/databases\/([^/]+)\/query/) || [])[1];
      const rec = store.get(db + ':' + code);
      if (!rec) return reply(200, { results: [] });
      const rt = name => ({ rich_text: rec.properties[name].rich_text.map(t => ({ plain_text: t.text.content })) });
      return reply(200, { results: [{ properties: { 'Result JSON': rt('Result JSON'), Answers: rt('Answers') } }] });
    }
    if (u.includes('/models/')) return reply(200, { id: 'm' });
    if (u.includes('/v1/databases/')) return reply(200, { id: 'db' });
    return reply(404, {});
  };
  return { fetchFn, store, log };
}

export const req = (method, path, body, headers = {}) =>
  new Request('http://localhost' + path, {
    method,
    headers: { 'content-type': 'application/json', host: 'localhost', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

export const CAREER_IDS = CAREERS.map(c => c.id);
