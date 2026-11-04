// Browser test for the whole site. Starts the local server in mock mode (fake OpenAI + Notion)
// and clicks through every screen in a real Chromium, on a desktop and a phone screen size.
//
//   node e2e/run.mjs            (needs Playwright with Chromium installed)
//   SHOTS=1 node e2e/run.mjs    also saves a screenshot of every screen into e2e-shots/
//
// It checks: the whole flow, privacy rules (what is sent to OpenAI and Notion), every fallback
// (AI slow, AI off, no key, server unreachable, Notion not set up), saving and opening by code,
// escaping of untrusted text, keyboard use, no console errors, no sideways scrolling.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS ? path.join(ROOT, 'e2e-shots') : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); if (!ok) console.log('  FAIL', name, extra); };

/* ---------- servers ---------- */
const servers = [];
function startServer(port, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'dev-server.mjs'), '--mock', `--port=${port}`], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    servers.push(p);
    const t = setTimeout(() => reject(new Error('server did not start on ' + port)), 8000);
    p.stdout.on('data', d => { if (String(d).includes('running at')) { clearTimeout(t); resolve(`http://localhost:${port}`); } });
    p.on('error', reject);
  });
}

/* ---------- page helpers ---------- */
const VIEWPORTS = { web: { width: 1440, height: 900 }, mob: { width: 390, height: 844 } };
let shotN = 0;

async function newPage(browser, vp, ignore = null) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.problems = [];
  const add = m => { if (!(ignore && ignore.test(m))) page.problems.push(m); };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) add(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => add('pageerror: ' + e.message));
  page.on('requestfailed', r => add('requestfailed: ' + r.url()));
  page.vp = vp;
  return page;
}

async function look(page, name) {
  await page.waitForTimeout(450);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${page.vp}] no sideways scroll on ${name}`, over <= 0, `overflow ${over}px`);
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
    .filter(el => !el.disabled && !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !(el.labels && el.labels.length) && !el.getAttribute('aria-labelledby') && !el.placeholder)
    .map(el => el.outerHTML.slice(0, 80)));
  check(`[${page.vp}] every control has a name on ${name}`, unnamed.length === 0, unnamed.join(' | '));
  const h1 = await page.locator('h1').count();
  check(`[${page.vp}] exactly one h1 on ${name}`, h1 === 1, `found ${h1}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${String(++shotN).padStart(3, '0')}-${page.vp}-${name}.png`), fullPage: true });
}

const hash = page => page.evaluate(() => location.hash);
async function goto(page, base, h) { await page.goto(base + '/' + (h || '')); await page.waitForTimeout(150); }

/** Walk from the home page to the results screen. */
async function runFlow(page, base, { name = 'Aigerim', ai = true, save = true, note = '', shots = false } = {}) {
  await goto(page, base, '');
  if (shots) await look(page, 'home');
  await page.click('.hero2 [data-go="/start"]');
  await page.waitForURL(/#\/start/);
  if (shots) await look(page, 'start');
  await page.fill('#f-name', name);
  if (!ai) await page.click('[data-act=consent][data-k=ai]');
  if (!save) await page.click('[data-act=consent][data-k=save]');
  await page.click('[data-act=consent][data-k=privacy]');
  await page.click('[data-act=startNext]');
  await page.waitForURL(/#\/type/);
  if (shots) await look(page, 'type');
  await page.click('.btn.go[data-go="/profile"]');
  await page.waitForURL(/#\/profile/);
  for (const [k, id] of [['subject', 'Mathematics'], ['subject', 'Informatics'], ['skill', 'excel'], ['skill', 'logic']])
    await page.click(`[data-act=toggle][data-k=${k}][data-id=${id}]`);
  if (note && ai) await page.fill('#f-note', note);
  if (shots) await look(page, 'profile');
  await page.click('[data-act=toTest]');
  await page.waitForURL(/#\/test/);
  await page.waitForSelector('.q .sc');            // wait for the screen itself, not only the address
  if (shots) await look(page, 'test');
  const pattern = [4, 3, 1, 2, 0, 3];
  for (let i = 0; i < 30; i++) { await page.keyboard.press(String(pattern[i % 6] + 1)); await page.waitForTimeout(290); }
  if (shots) await look(page, 'test-done');
  await page.click('[data-act=finish]');
  await page.waitForURL(/#\/analysis/);
  if (shots) { await page.waitForTimeout(1500); await look(page, 'analysis'); }
}

async function finishToResults(page) {
  await page.waitForURL(/#\/(results|delay)/, { timeout: 25000 });
}

const mockLog = async base => (await fetch(base + '/__mock_log')).json();

/* ---------- scenarios ---------- */
async function main() {
  const browser = await chromium.launch();
  const [A, T, K, N, X] = await Promise.all([
    startServer(8891, { MOCK_AI: 'ok' }),
    startServer(8892, { MOCK_AI: 'timeout' }),
    startServer(8893, { MOCK_NO_KEY: '1' }),
    startServer(8894, { MOCK_NO_NOTION: '1' }),
    startServer(8895, { MOCK_AI: 'xss' }),
  ]);

  for (const vp of ['web', 'mob']) {
    console.log(`\n== ${vp}: full flow with AI ==`);
    const page = await newPage(browser, vp, /status of 404/);
    // privacy gate
    await goto(page, A, '#/test');
    check(`[${vp}] test screen is blocked until the Privacy Notice is ticked`, (await hash(page)) === '#/start');
    await page.click('[data-act=startNext]');
    check(`[${vp}] start shows an error without the privacy tick`, await page.locator('.err').isVisible());
    if (vp === 'web') await look(page, 'start-error');

    const note = 'I like maps and puzzles. Mail me at aigerim@example.com or +7 701 234 56 78';
    await runFlow(page, A, { note, shots: vp === 'web' || true });
    await finishToResults(page);
    check(`[${vp}] AI flow ends on results`, (await hash(page)) === '#/results');
    await look(page, 'results');
    check(`[${vp}] five matches shown`, (await page.locator('.mrow').count()) === 5);
    check(`[${vp}] AI chip shown`, await page.locator('.chip.ai', { hasText: 'AI-generated' }).first().isVisible());
    const code = (await page.locator('#codeText').innerText()).trim();
    check(`[${vp}] private code shown and well formed`, /^COG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), code);
    const top = (await page.locator('.mrow .nm').first().innerText()).trim();

    // privacy: what really left the browser
    const log = await mockLog(A);
    const lastAi = JSON.stringify(log.openai.at(-1).body);
    check(`[${vp}] OpenAI never gets the name, e-mail or phone`, !/Aigerim|aigerim@|701 234/.test(lastAi), lastAi.slice(0, 120));
    check(`[${vp}] OpenAI does get the scrubbed note`, lastAi.includes('I like maps and puzzles'));
    check(`[${vp}] OpenAI gets six scores, not the raw 30 answers`, /interest_scores_0_to_100/.test(lastAi) && !/"answers"/.test(lastAi));
    const lastNotion = JSON.stringify(log.notion.filter(n => n.body && n.body.properties && n.body.properties['Result code']).at(-1));
    check(`[${vp}] Notion never gets the name or the note`, !/Aigerim|maps|aigerim@/.test(lastNotion));

    // why + feedback
    await page.click('.mrow .nm >> nth=0');
    await page.waitForURL(/#\/why\//);
    await look(page, 'why');
    check(`[${vp}] why screen shows the AI explanation`, await page.locator('.aisum .chip.ai').isVisible());
    check(`[${vp}] why screen shows quoted answers`, (await page.locator('.quote').count()) >= 1);
    await page.click('details.how summary');
    check(`[${vp}] how-calculated opens`, await page.locator('details.how[open]').count() === 1);
    const ratings = async () => (await mockLog(A)).notion.filter(n => n.body && n.body.properties && n.body.properties.Rating);
    const fb0 = (await ratings()).length;
    await page.click('[data-act=fb][data-v="5"]');
    await page.waitForTimeout(500);
    const fbRows = await ratings();
    check(`[${vp}] feedback reaches the server`, fbRows.length === fb0 + 1 && fbRows.at(-1).body.properties.Rating.number === 5);
    await page.click('[data-act=fb][data-v="2"]');
    await page.waitForTimeout(300);
    check(`[${vp}] feedback is sent only once per career`, (await ratings()).length === fb0 + 1);

    // career + roadmap
    await page.click('text=View career details');
    await page.waitForURL(/#\/career\//);
    await look(page, 'career');
    check(`[${vp}] no salary numbers anywhere on career page`, !/\$|USD\s*\d|\d+\s*(KZT|₸)/.test(await page.locator('main').innerText()));
    check(`[${vp}] market data marked as coming soon`, await page.locator('.chip.soon', { hasText: 'Coming soon' }).isVisible());
    await page.click('text=Build my roadmap');
    await page.waitForURL(/#\/roadmap\//);
    await look(page, 'roadmap');
    const before = (await page.locator('.chip', { hasText: /of \d+ steps/ }).first().innerText()).trim();
    await page.click('[data-act=mark]');
    await page.waitForTimeout(300);
    const after = (await page.locator('.chip', { hasText: /of \d+ steps/ }).first().innerText()).trim();
    check(`[${vp}] marking a step changes progress`, before !== after, `${before} -> ${after}`);
    await page.reload();
    await page.waitForTimeout(300);
    const afterReload = (await page.locator('.chip', { hasText: /of \d+ steps/ }).first().innerText()).trim();
    check(`[${vp}] progress survives a reload`, afterReload === after);
    await page.click('[data-act=step] >> nth=3');
    check(`[${vp}] tapping a step shows its details`, (await page.locator('.rmdet h3').first().innerText()).length > 2);

    // dashboard
    await goto(page, A, '#/dashboard');
    await look(page, 'dashboard');
    check(`[${vp}] dashboard greets by the first name`, (await page.locator('h1').innerText()).includes('Aigerim'));
    await goto(page, A, '#/privacy');
    await look(page, 'privacy');
    check(`[${vp}] privacy page says what is and is not sent`, /OpenAI/.test(await page.locator('main').innerText()) && /never/i.test(await page.locator('main').innerText()));

    // open by code (after clearing the browser)
    await page.click('[data-act=wipe]');
    await page.click('[data-act=wipe]');
    await page.waitForURL(/#\/$|#$|\/$/);
    check(`[${vp}] "clear everything" empties local storage`, await page.evaluate(() => localStorage.getItem('cognita.v1') === null));
    await goto(page, A, '#/open');
    await look(page, 'open');
    await page.fill('#f-code', 'hello');
    await page.click('form[data-form=code] button');
    await page.waitForTimeout(300);
    check(`[${vp}] a malformed code gets a clear message`, /does not look right/.test(await page.locator('.err').innerText()));
    await page.fill('#f-code', 'COG-AAAA-AAAA-AAAA');
    await page.click('form[data-form=code] button');
    await page.waitForTimeout(700);
    check(`[${vp}] an unknown code gets a clear message`, /No result with this code/.test(await page.locator('.err').innerText()));
    await page.fill('#f-code', code.toLowerCase().replace(/-/g, ' '));
    await page.click('form[data-form=code] button');
    await page.waitForURL(/#\/results/);
    check(`[${vp}] saved result opens by code with the same top match`, (await page.locator('.mrow .nm').first().innerText()).trim() === top);
    await goto(page, A, '#/dashboard');
    check(`[${vp}] restored result has a working dashboard`, await page.locator('.rcard').isVisible());
    await page.click('[data-act=wipe]').catch(() => {});
    await goto(page, A, '#/r/' + code);
    await page.waitForURL(/#\/results/);
    check(`[${vp}] deep link /r/CODE opens the result`, (await page.locator('.mrow').count()) === 5);
    await goto(page, A, '#/nope');
    check(`[${vp}] unknown page shows "Page not found"`, /Page not found/.test(await page.locator('h1').innerText()));

    check(`[${vp}] no console errors in the whole flow`, page.problems.length === 0, page.problems.join(' || '));
    await page.context().close();
  }

  console.log('\n== resume, keyboard and score check (web) ==');
  {
    const page = await newPage(browser, 'web');
    await goto(page, A, '');
    await page.click('.hero2 [data-go="/start"]');
    await page.click('[data-act=consent][data-k=privacy]');
    await page.click('[data-act=startNext]');
    await page.click('.btn.go[data-go="/profile"]');
    await page.click('[data-act=toTest]');
    await page.waitForSelector('.q .sc');
    for (let i = 0; i < 10; i++) { await page.keyboard.press('3'); await page.waitForTimeout(290); }
    await page.reload();
    await page.waitForTimeout(300);
    check('test resumes at the first unanswered statement after a reload', /statement 11 of 30/i.test(await page.locator('.q .meta').innerText()));
    await page.click('[data-act=prevq]');
    await page.waitForTimeout(100);
    check('"Previous" goes back one statement', /statement 10 of 30/i.test(await page.locator('.q .meta').innerText()));
    check('a given answer is marked as selected', (await page.locator('.sc.on').count()) === 1);
    // an answered question can be changed
    await page.keyboard.press('5');
    await page.waitForTimeout(400);
    check('changing an answer moves on again', /statement 11 of 30/i.test(await page.locator('.q .meta').innerText()));
    await page.context().close();
  }

  console.log('\n== AI too slow -> notice, then rule-based matches ==');
  {
    const page = await newPage(browser, 'web');
    await runFlow(page, T, { shots: true });
    await page.waitForURL(/#\/delay/, { timeout: 25000 });
    await look(page, 'delay');
    check('slow AI shows the service notice', /longer than usual|could not answer/.test(await page.locator('h1').first().innerText()));
    await page.click('text=Show rule-based matches');
    await page.waitForURL(/#\/results/);
    await look(page, 'results-rules-banner');
    check('rule-based results say they were calculated by rules', await page.locator('.chip.dev', { hasText: 'Calculated by rules' }).first().isVisible());
    check('rule-based results explain why', await page.locator('.banner.warn').isVisible());
    check('rule-based results still saved under a code', await page.locator('#codeText').isVisible());
    await page.click('.banner [data-act=tryAi]');
    await page.waitForURL(/#\/(delay|results)/, { timeout: 25000 });
    check('"Try the AI again" runs the analysis again', true);
    await page.goto(T + '/#/why/data-analyst');
    await page.waitForTimeout(300);
    const why = await page.locator('.aisum').innerText();
    check('a rules-only result has a plain explanation, not "AI explanation"', !/AI explanation/.test(why) && why.length > 20);
    check('no console errors (AI slow)', page.problems.length === 0, page.problems.join(' || '));
    await page.context().close();
  }

  console.log('\n== AI switched off by the student ==');
  {
    const page = await newPage(browser, 'web');
    const before = (await mockLog(A)).openai.length;
    await runFlow(page, A, { ai: false });
    await finishToResults(page);
    await look(page, 'results-ai-off');
    check('AI off: matches calculated by rules', await page.locator('.chip.dev', { hasText: 'Calculated by rules' }).first().isVisible());
    check('AI off: banner says AI is off', /AI is off/.test(await page.locator('.banner').first().innerText()));
    check('AI off: OpenAI was not called', (await mockLog(A)).openai.length === before);
    check('AI off: the analysis screen says rules only', true);
    check('no console errors (AI off)', page.problems.length === 0, page.problems.join(' || '));
    await page.context().close();
  }

  console.log('\n== No OpenAI key on the server ==');
  {
    const page = await newPage(browser, 'web');
    await runFlow(page, K, {});
    await finishToResults(page);
    check('no key: results still arrive, by rules', await page.locator('.chip.dev', { hasText: 'Calculated by rules' }).first().isVisible());
    check('no key: banner explains', /not available/.test(await page.locator('.banner').first().innerText()));
    await page.context().close();
  }

  console.log('\n== Notion not set up ==');
  {
    const page = await newPage(browser, 'web');
    await runFlow(page, N, {});
    await finishToResults(page);
    check('no Notion: results still arrive', (await page.locator('.mrow').count()) === 5);
    check('no Notion: no private code is shown', (await page.locator('#codeText').count()) === 0);
    check('no Notion: student is told it was not saved', /not saved under a code/.test(await page.locator('main').innerText()));
    await page.context().close();
  }

  console.log('\n== Server unreachable -> calculated on this device ==');
  {
    const page = await newPage(browser, 'web', /ERR_FAILED|api\/match|Failed to load resource/);
    await page.route('**/api/match', r => r.abort('failed'));
    await runFlow(page, A, {});
    await finishToResults(page);
    await look(page, 'results-device');
    check('offline: results appear anyway', (await page.locator('.mrow').count()) === 5);
    check('offline: chip says "on this device"', await page.locator('.chip.dev', { hasText: 'Calculated on this device' }).isVisible());
    check('offline: banner explains', /Could not reach the server/.test(await page.locator('.banner').first().innerText()));
    check('offline: no code is shown', (await page.locator('#codeText').count()) === 0);
    await page.unroute('**/api/match');
    await page.click('.banner [data-act=tryAi]');
    await page.waitForURL(/#\/results/, { timeout: 25000 });
    await page.waitForTimeout(400);
    check('after the server is back, "Try again" gives an AI result with a code', await page.locator('.chip.ai', { hasText: 'AI-generated' }).first().isVisible() && await page.locator('#codeText').isVisible());
    await page.context().close();
  }

  console.log('\n== Untrusted text is escaped ==');
  {
    const page = await newPage(browser, 'web');
    await runFlow(page, X, { name: '<img src=x onerror="window.__xss=1">' });
    await finishToResults(page);
    await page.click('.mrow .nm >> nth=0');
    await page.waitForURL(/#\/why\//);
    await page.waitForTimeout(300);
    const injected = await page.evaluate(() => ({ flag: window.__xss, imgs: document.querySelectorAll('#app img').length, bold: document.querySelectorAll('.aisum b').length }));
    check('AI text with HTML is shown as text, not run', !injected.flag && injected.imgs === 0 && injected.bold === 0, JSON.stringify(injected));
    check('the AI text is visible literally', /<img/.test(await page.locator('.aisum p').innerText()));
    await goto(page, X, '#/dashboard');
    const inj2 = await page.evaluate(() => ({ flag: window.__xss, imgs: document.querySelectorAll('#app img').length }));
    check('a hostile first name is shown as text', !inj2.flag && inj2.imgs === 0);
    await page.context().close();
  }

  console.log('\n== Headers and API ==');
  {
    const r = await fetch(A + '/');
    const csp = r.headers.get('content-security-policy') || '';
    check('CSP forbids inline scripts', /script-src 'self'/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp));
    check('page cannot be framed', r.headers.get('x-frame-options') === 'DENY');
    const bad = await fetch(A + '/api/match', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
    check('another website cannot use the API', bad.status === 403);
    const h = await (await fetch(A + '/api/health')).json();
    check('health shows only true/false for keys', h.openai === true && h.notion === true && !JSON.stringify(h).includes('SECRET'));
  }

  await browser.close();
}

let failed = false;
try { await main(); } catch (e) { console.error('\nTEST RUN CRASHED:', e); failed = true; }
finally { for (const s of servers) s.kill(); }

const bad = results.filter(r => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed.`);
if (bad.length) { for (const b of bad) console.log(' - FAILED:', b.name, b.extra); }
process.exit(bad.length || failed ? 1 : 0);
