import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAssist } from '../netlify/lib/handlers.mjs';
import { _resetRateLimit } from '../netlify/lib/http.mjs';
import { COMPARE_ASPECTS } from '../netlify/lib/assist.mjs';
import { CAREER_BY_ID } from '../public/shared/careers.mjs';
import { ENV, makeFetch, req } from './helpers.mjs';

test.beforeEach(() => _resetRateLimit());

const post = (body, headers) => req('POST', '/api/assist', body, headers);
const read = async res => ({ status: res.status, body: await res.json() });
const person = { mode: 'student', skills: ['excel', 'logic'], areas: { analytical: 80, technical: 70, organising: 40, creative: 30, enterprising: 20, social: 50 } };
const run = async (body, f = makeFetch(), env = ENV) => ({ ...(await read(await handleAssist(post(body), env, f.fetchFn))), f });

test('assist: all five tools answer through the AI', async () => {
  const sw = 'software-engineer';
  const g = await run({ kind: 'gap', career: sw, person });
  assert.equal(g.status, 200);
  assert.ok(g.body.data.steps.length >= 1);
  assert.ok(g.body.data.steps.every(s => CAREER_BY_ID[sw].skills.includes(s.id) && !person.skills.includes(s.id)));

  const c = await run({ kind: 'compare', a: sw, b: 'frontend-developer', person });
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.data.rows.map(r => r.aspect), COMPARE_ASPECTS);

  const m = await run({ kind: 'chat', message: 'How do I start in IT?', history: [] });
  assert.equal(m.status, 200);
  assert.ok(m.body.data.answer.length > 0);
  assert.ok(m.body.data.careers.every(id => CAREER_BY_ID[id]));

  const l = await run({ kind: 'learn', career: sw, step: 'sql', person });
  assert.equal(l.status, 200);
  assert.ok(l.body.data.plan.length >= 2 && l.body.data.search.length >= 1);

  const i = await run({ kind: 'interview', career: sw, person });
  assert.equal(i.status, 200);
  assert.equal(i.body.data.questions.length, 5);

  const a = await run({ kind: 'answer', career: sw, question: 'Why this career?', answer: 'I like building small apps.' });
  assert.equal(a.status, 200);
  assert.ok(a.body.data.score >= 1 && a.body.data.score <= 5);
});

test('assist: each tool uses its own strict schema, the key stays on the server', async () => {
  const { body, f } = await run({ kind: 'compare', a: 'software-engineer', b: 'data-analyst' });
  assert.ok(!JSON.stringify(body).includes('SECRET'));
  const rf = f.log.openai[0].body.response_format;
  assert.equal(rf.json_schema.name, 'career_comparison');
  assert.equal(rf.json_schema.strict, true);
});

test('assist: e-mails and phone numbers are removed before the AI sees free text', async () => {
  const { f } = await run({ kind: 'chat', message: 'Mail me at test.user@mail.kz or +7 701 123 45 67 about design', history: [{ role: 'user', text: 'I am ana@x.com' }] });
  const sent = f.log.openai[0].body.messages[1].content;
  assert.ok(!sent.includes('test.user@mail.kz') && !sent.includes('701 123') && !sent.includes('ana@x.com'));
  assert.ok(sent.includes('[removed]'));
  const { f: f2 } = await run({ kind: 'answer', career: 'software-engineer', question: 'Tell me about you', answer: 'Call me on 87011234567 please' });
  assert.ok(!f2.log.openai[0].body.messages[1].content.includes('87011234567'));
});

test('assist: the AI answer is checked (wrong ids, links, empty answers)', async () => {
  const f = makeFetch({ assist: (task) => task === 'skill_gap_coach'
    ? { summary: 'ok', steps: [{ id: 'not-a-skill', why: 'x', first_step: 'y' }, { id: 'excel', why: 'already has it', first_step: 'y' }, { id: 'git', why: 'Teams share code with it.', first_step: 'Go to https://evil.example.com and www.spam.com now' }] }
    : task === 'career_mentor' ? { answer: 'Read more at https://example.com/x today.', on_topic: true, careers: ['software-engineer', 'nope', 'software-engineer'] }
    : {} });
  const g = await run({ kind: 'gap', career: 'software-engineer', person }, f);
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.data.steps.map(s => s.id), ['git']);
  assert.ok(!/https?:|www\./.test(g.body.data.steps[0].first));
  const m = await run({ kind: 'chat', message: 'hi', history: [] }, f);
  assert.ok(!m.body.data.answer.includes('https://'));
  assert.deepEqual(m.body.data.careers, ['software-engineer']);
  const c = await run({ kind: 'compare', a: 'software-engineer', b: 'data-analyst' }, f);
  assert.equal(c.status, 502);
});

test('assist: no key, AI down or slow give a clear error, never a fake answer', async () => {
  assert.equal((await run({ kind: 'interview', career: 'software-engineer' }, makeFetch(), { ...ENV, OPENAI_API_KEY: '' })).status, 503);
  assert.equal((await run({ kind: 'interview', career: 'software-engineer' }, makeFetch({ ai: 'http500' }))).status, 502);
  assert.equal((await run({ kind: 'interview', career: 'software-engineer' }, makeFetch({ ai: 'timeout' }))).status, 504);
});

test('assist: no AI call when every core skill is already ticked', async () => {
  const all = { mode: 'pro', skills: CAREER_BY_ID['software-engineer'].skills.slice() };
  const { status, body, f } = await run({ kind: 'gap', career: 'software-engineer', person: all });
  assert.equal(status, 200);
  assert.equal(body.data.steps.length, 0);
  assert.equal(f.log.openai.length, 0);
});

test('assist: input checks, method, other websites, rate limit', async () => {
  const bad = [
    {}, { kind: 'x' }, { kind: 'gap' }, { kind: 'gap', career: 'nope' }, { kind: 'compare', a: 'software-engineer', b: 'software-engineer' },
    { kind: 'chat', message: '   ' }, { kind: 'chat', message: 'hi', history: 'x' }, { kind: 'chat', message: 'hi', history: Array(7).fill({ role: 'user', text: 'a' }) },
    { kind: 'learn', career: 'software-engineer', step: 'cook' }, { kind: 'answer', career: 'software-engineer', question: 'q', answer: '' },
    { kind: 'gap', career: 'software-engineer', person: { mode: 'boss' } }, { kind: 'gap', career: 'software-engineer', person: { skills: ['excel', 'excel'] } },
    { kind: 'gap', career: 'software-engineer', person: { areas: { analytical: 500 } } },
  ];
  for (const b of bad) assert.equal((await run(b)).status, 400, JSON.stringify(b));
  assert.equal((await read(await handleAssist(req('GET', '/api/assist'), ENV, makeFetch().fetchFn))).status, 405);
  assert.equal((await read(await handleAssist(post({ kind: 'interview', career: 'software-engineer' }, { origin: 'https://evil.example' }), ENV, makeFetch().fetchFn))).status, 403);
  _resetRateLimit();
  const env = { ...ENV, RATE_LIMIT_MAX: '2' };
  const f = makeFetch();
  for (let i = 0; i < 2; i++) assert.equal((await run({ kind: 'interview', career: 'software-engineer' }, f, env)).status, 200);
  assert.equal((await run({ kind: 'interview', career: 'software-engineer' }, f, env)).status, 429);
});

test('assist: the mentor keeps line breaks for short lists', async () => {
  const f = makeFetch({ assist: () => ({ answer: 'Start here:\n- Learn the basics\n- Build a small project', on_topic: true, careers: [] }) });
  const { body } = await run({ kind: 'chat', message: 'How do I start?', history: [] }, f);
  assert.equal(body.data.answer, 'Start here:\n- Learn the basics\n- Build a small project');
});
