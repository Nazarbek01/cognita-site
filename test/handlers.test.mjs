import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMatch, handleResult, handleFeedback, handleHealth } from '../netlify/lib/handlers.mjs';
import { _resetRateLimit } from '../netlify/lib/http.mjs';
import { makeCode, CODE_RE } from '../netlify/lib/notion.mjs';
import { ENV, goodInput, makeFetch, req, fakeAiAnswer } from './helpers.mjs';

test.beforeEach(() => _resetRateLimit());

const post = (body, headers) => req('POST', '/api/match', body, headers);
const read = async res => ({ status: res.status, body: await res.json() });

test('match: AI works -> source ai, result saved, private code returned', async () => {
  const f = makeFetch();
  const { status, body } = await read(await handleMatch(post(goodInput()), ENV, f.fetchFn));
  assert.equal(status, 200);
  assert.equal(body.result.source, 'ai');
  assert.equal(body.result.aiStatus, 'ok');
  assert.equal(body.result.matches.length, 5);
  assert.match(body.code, /^COG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(body.saveStatus, 'saved');
  // the key goes only to OpenAI as a header, never into the response
  assert.ok(!JSON.stringify(body).includes('SECRET'));
  assert.equal(f.log.openai[0].headers.Authorization, 'Bearer ' + ENV.OPENAI_API_KEY);
  assert.equal(f.log.openai[0].body.model, 'gpt-6-luna');
  assert.equal(f.log.openai[0].body.response_format.type, 'json_schema');
  assert.equal(f.log.openai[0].body.response_format.json_schema.strict, true);
});

test('match: the AI shift is limited and results are sorted', async () => {
  const f = makeFetch({ ai: payload => fakeAiAnswer(payload, { shift: 60 }) });
  const { body } = await read(await handleMatch(post(goodInput({ save: false })), ENV, f.fetchFn));
  assert.equal(body.result.source, 'ai');
  const m = body.result.matches;
  assert.ok(m.every((x, i) => i === 0 || m[i - 1].match >= x.match));
  assert.ok(m[0].match <= 99);
});

test('match: nothing personal reaches OpenAI or Notion; the free-text note is scrubbed and not stored', async () => {
  const f = makeFetch();
  const note = 'My name is Aigerim, mail aigerim@example.com, phone +7 701 234 56 78. I love maps.';
  const { body } = await read(await handleMatch(post(goodInput({ note, name: 'Aigerim', email: 'aigerim@example.com' })), ENV, f.fetchFn));
  assert.equal(body.saveStatus, 'saved');
  const sentToAi = JSON.stringify(f.log.openai[0].body);
  assert.ok(!sentToAi.includes('aigerim@example.com') && !sentToAi.includes('701 234'));
  assert.ok(sentToAi.includes('I love maps'));
  const sentToNotion = JSON.stringify(f.log.notion);
  assert.ok(!sentToNotion.includes('aigerim') && !sentToNotion.includes('maps') && !sentToNotion.includes('Aigerim'));
  const keys = Object.keys(f.log.notion[0].body.properties).sort();
  assert.deepEqual(keys, ['Answers', 'Area scores', 'Catalogue version', 'Consent', 'Grade', 'Result JSON', 'Result code', 'Skills', 'Source', 'Subjects', 'Top career', 'Top match'].sort());
});

test('match: useAi=false never calls OpenAI', async () => {
  const f = makeFetch();
  const { body } = await read(await handleMatch(post(goodInput({ useAi: false, save: false })), ENV, f.fetchFn));
  assert.equal(body.result.source, 'rules');
  assert.equal(body.result.aiStatus, 'off');
  assert.equal(f.log.openai.length, 0);
  assert.equal(body.code, null);
  assert.equal(body.saveStatus, 'off');
});

test('match: falls back to rules when the key is missing, the AI is slow, broken or refuses', async () => {
  const cases = [
    [{ ...ENV, OPENAI_API_KEY: '' }, {}, 'no_key'],
    [ENV, { ai: 'timeout' }, 'timeout'],
    [ENV, { ai: 'http500' }, 'error'],
    [ENV, { ai: 'garbage' }, 'error'],
    [ENV, { ai: 'refusal' }, 'error'],
    [ENV, { ai: () => ({ matches: [] }) }, 'error'],
    [ENV, { ai: () => ({ nothing: true }) }, 'error'],
  ];
  for (const [env, opts, status] of cases) {
    const f = makeFetch(opts);
    const { status: http, body } = await read(await handleMatch(post(goodInput()), env, f.fetchFn));
    assert.equal(http, 200, status);
    assert.equal(body.result.source, 'rules', status);
    assert.equal(body.result.aiStatus, status);
    assert.equal(body.result.matches.length, 5);
    assert.equal(body.saveStatus, 'saved');                // saving still works without AI
  }
});

test('match: Notion down or not configured does not break the result', async () => {
  const down = makeFetch({ notion: 'down' });
  let r = await read(await handleMatch(post(goodInput()), ENV, down.fetchFn));
  assert.equal(r.status, 200);
  assert.equal(r.body.saveStatus, 'error');
  assert.equal(r.body.code, null);
  assert.equal(r.body.result.source, 'ai');
  const f = makeFetch();
  r = await read(await handleMatch(post(goodInput()), { ...ENV, NOTION_TOKEN: '' }, f.fetchFn));
  assert.equal(r.body.saveStatus, 'not_configured');
  assert.equal(r.body.result.matches.length, 5);
});

test('match: input checks, method, size, other websites, rate limit', async () => {
  const f = makeFetch();
  assert.equal((await handleMatch(req('GET', '/api/match'), ENV, f.fetchFn)).status, 405);
  assert.equal((await handleMatch(post('{not json'), ENV, f.fetchFn)).status, 400);
  assert.equal((await handleMatch(post({ ...goodInput(), answers: [1, 2] }), ENV, f.fetchFn)).status, 400);
  assert.equal((await handleMatch(post({ ...goodInput(), note: 'x'.repeat(30000) }), ENV, f.fetchFn)).status, 413);
  assert.equal((await handleMatch(post(goodInput(), { origin: 'https://evil.example' }), ENV, f.fetchFn)).status, 403);
  assert.equal((await handleMatch(post(goodInput(), { origin: 'http://localhost' }), ENV, f.fetchFn)).status, 200);
  assert.equal(f.log.openai.length, 1);                   // rejected requests never reach OpenAI
  _resetRateLimit();
  const tight = { ...ENV, RATE_LIMIT_MAX: '2' };
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await handleMatch(post(goodInput({ save: false })), tight, makeFetch().fetchFn)).status);
  assert.deepEqual(codes, [200, 200, 429, 429]);
});

test('result: save then open by code; bad and unknown codes', async () => {
  const f = makeFetch();
  const saved = (await read(await handleMatch(post(goodInput()), ENV, f.fetchFn))).body;
  const res = await read(await handleResult(req('GET', '/api/result?code=' + saved.code.toLowerCase()), ENV, f.fetchFn));
  assert.equal(res.status, 200);
  assert.equal(res.body.result.matches[0].id, saved.result.matches[0].id);
  assert.equal(res.body.result.answers.length, 30);
  assert.equal((await handleResult(req('GET', '/api/result?code=COG-AAAA-AAAA-AAAA'), ENV, f.fetchFn)).status, 404);
  assert.equal((await handleResult(req('GET', '/api/result?code=hello'), ENV, f.fetchFn)).status, 400);
  assert.equal((await handleResult(req('GET', '/api/result'), ENV, f.fetchFn)).status, 400);
  assert.equal((await handleResult(req('GET', '/api/result?code=' + saved.code), { ...ENV, NOTION_TOKEN: '' }, f.fetchFn)).status, 503);
  assert.equal((await handleResult(req('GET', '/api/result?code=' + saved.code), ENV, makeFetch({ notion: 'down' }).fetchFn)).status, 502);
  assert.equal((await handleResult(req('POST', '/api/result', {}), ENV, f.fetchFn)).status, 405);
});

test('feedback: validation and saving', async () => {
  const f = makeFetch();
  const code = makeCode();
  const fb = (b, env = ENV, fx = f) => handleFeedback(req('POST', '/api/feedback', b), env, fx.fetchFn);
  assert.equal((await fb({ code, rating: 5, career: 'data-analyst', comment: 'Helpful\nthanks' })).status, 200);
  const props = f.log.notion.at(-1).body.properties;
  assert.equal(props.Rating.number, 5);
  assert.equal(props.Comment.rich_text[0].text.content, 'Helpful thanks');
  assert.equal((await fb({ code: 'DEVICE', rating: 1 })).status, 200);
  assert.equal((await fb({ code, rating: 6 })).status, 400);
  assert.equal((await fb({ code, rating: 2.5 })).status, 400);
  assert.equal((await fb({ code: 'bad', rating: 3 })).status, 400);
  assert.equal((await fb({ code, rating: 3, career: 'astronaut' })).status, 200);
  assert.deepEqual(f.log.notion.at(-1).body.properties.Career.rich_text, []);   // unknown career is dropped
  assert.equal((await fb({ code, rating: 3, comment: 'x'.repeat(9000) })).status, 413);
  assert.equal((await fb({ code, rating: 3 }, { ...ENV, NOTION_RESULTS_DB: '' })).status, 503);
  assert.equal((await fb({ code, rating: 3 }, ENV, makeFetch({ notion: 'down' }))).status, 502);
});

test('health: shows true/false only; deep check needs the admin token', async () => {
  const f = makeFetch();
  const h = await read(await handleHealth(req('GET', '/api/health'), ENV, f.fetchFn));
  assert.deepEqual(h.body, { ok: true, openai: true, notion: true, model: 'gpt-6-luna' });
  assert.ok(!JSON.stringify(h.body).includes('SECRET') && !JSON.stringify(h.body).includes('secret_notion'));
  const env = { ...ENV, ADMIN_TOKEN: 'letmein' };
  const no = await read(await handleHealth(req('GET', '/api/health?deep=1'), env, f.fetchFn));
  assert.equal(no.body.deep, undefined);
  const wrong = await read(await handleHealth(req('GET', '/api/health?deep=1', undefined, { 'x-admin-token': 'nope' }), env, f.fetchFn));
  assert.equal(wrong.body.deep, undefined);
  const yes = await read(await handleHealth(req('GET', '/api/health?deep=1', undefined, { 'x-admin-token': 'letmein' }), env, f.fetchFn));
  assert.deepEqual(yes.body.deep, { openai: 'ok', notionResults: 'ok', notionFeedback: 'ok' });
});

test('codes: format and uniqueness', () => {
  const set = new Set(Array.from({ length: 2000 }, () => makeCode()));
  assert.equal(set.size, 2000);
  for (const c of set) assert.match(c, CODE_RE);
});
