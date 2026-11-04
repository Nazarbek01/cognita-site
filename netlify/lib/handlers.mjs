// The four API handlers. They take (request, env, fetch) so tests can pass fakes.
// The files in netlify/functions/ only wire these to URLs.

import { CAREER_BY_ID } from '../../public/shared/careers.mjs';
import { LIMITS } from '../../public/shared/config.mjs';
import { validateInput, scoreAreas, rankCareers, aiPayload, sanitizeAi, aiResult, rulesResult, looksLikeResult } from '../../public/shared/engine.mjs';
import { json, fail, readJson, rateLimit, clientIp, sameOrigin, fetchTimeout } from './http.mjs';
import { askOpenAI, DEFAULT_MODEL } from './openai.mjs';
import { notionReady, saveResult, loadResult, saveFeedback, CODE_RE } from './notion.mjs';

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

function guard(req, env, name, max) {
  if (!sameOrigin(req)) return fail(403, 'Request from another website was refused.');
  const win = 10 * 60 * 1000;
  if (!rateLimit(`${name}:${clientIp(req)}`, num(env.RATE_LIMIT_MAX, max), win))
    return fail(429, 'Too many requests. Please wait a few minutes and try again.');
  return null;
}

/** POST /api/match  { answers[30], profile, note?, useAi, save } -> { result, code?, saved } */
export async function handleMatch(req, env, fetchFn) {
  if (req.method !== 'POST') return fail(405, 'Use POST.');
  const blocked = guard(req, env, 'match', 15);
  if (blocked) return blocked;

  let body;
  try { body = await readJson(req); } catch (e) { return fail(e.status || 400, e.message); }
  const v = validateInput(body);
  if (!v.ok) return fail(400, v.error);
  const input = v.value;

  let result;
  if (!input.useAi) {
    result = rulesResult(input, 'off');
  } else if (!env.OPENAI_API_KEY) {
    result = rulesResult(input, 'no_key');
  } else {
    try {
      const areas = scoreAreas(input.answers);
      const ranked = rankCareers(areas, input.profile);
      const raw = await askOpenAI(env, fetchFn, aiPayload(input, areas, ranked));
      const matches = sanitizeAi(raw, ranked, input);
      result = matches ? aiResult(input, areas, matches) : rulesResult(input, 'error');
    } catch (e) {
      console.warn('[match] AI not used:', e.aiStatus || 'error', e.message);
      result = rulesResult(input, e.aiStatus || 'error');
    }
  }

  let code = null;
  let saveStatus = 'off';
  if (input.save) {
    if (!notionReady(env)) saveStatus = 'not_configured';
    else {
      try { code = await saveResult(env, fetchFn, { result, answers: input.answers, consent: true }); saveStatus = 'saved'; }
      catch (e) { console.warn('[match] Notion save failed:', e.message); saveStatus = 'error'; }
    }
  }
  return json({ ok: true, result, code, saveStatus });
}

/** GET /api/result?code=COG-XXXX-XXXX-XXXX -> { result } */
export async function handleResult(req, env, fetchFn) {
  if (req.method !== 'GET') return fail(405, 'Use GET.');
  const blocked = guard(req, env, 'result', 40);
  if (blocked) return blocked;
  const code = (new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
  if (!CODE_RE.test(code)) return fail(400, 'That code does not look right. It has the form COG-XXXX-XXXX-XXXX.');
  if (!notionReady(env)) return fail(503, 'Saved results are not available on this site yet.');
  try {
    const found = await loadResult(env, fetchFn, code);
    if (!found || !looksLikeResult(found.result)) return fail(404, 'No result with this code.');
    return json({ ok: true, result: { ...found.result, answers: found.answers } });
  } catch (e) {
    console.warn('[result] Notion read failed:', e.message);
    return fail(502, 'Could not load the saved result. Try again in a minute.');
  }
}

/** POST /api/feedback { code, rating 1-5, career?, comment? } */
export async function handleFeedback(req, env, fetchFn) {
  if (req.method !== 'POST') return fail(405, 'Use POST.');
  const blocked = guard(req, env, 'feedback', 10);
  if (blocked) return blocked;
  let b;
  try { b = await readJson(req, 4000); } catch (e) { return fail(e.status || 400, e.message); }
  const code = String((b && b.code) || '').toUpperCase();
  const rating = b && b.rating;
  if (!(CODE_RE.test(code) || code === 'DEVICE')) return fail(400, 'code is not valid.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400, 'rating must be 1 to 5.');
  const career = b.career && CAREER_BY_ID[b.career] ? b.career : '';
  const comment = String(b.comment || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.commentMax);
  if (!notionReady(env)) return fail(503, 'Feedback is not available on this site yet.');
  try { await saveFeedback(env, fetchFn, { code, rating, career, comment }); return json({ ok: true }); }
  catch (e) { console.warn('[feedback] Notion save failed:', e.message); return fail(502, 'Could not send feedback. Try again later.'); }
}

/**
 * GET /api/health -> which services are configured (true/false only, never the secrets).
 * With ADMIN_TOKEN set, add header "x-admin-token" and ?deep=1 to also test the real connections.
 */
export async function handleHealth(req, env, fetchFn) {
  if (req.method !== 'GET') return fail(405, 'Use GET.');
  const out = { ok: true, openai: !!env.OPENAI_API_KEY, notion: notionReady(env), model: env.OPENAI_MODEL || DEFAULT_MODEL };
  const url = new URL(req.url);
  if (url.searchParams.get('deep') === '1' && env.ADMIN_TOKEN && req.headers.get('x-admin-token') === env.ADMIN_TOKEN) {
    out.deep = {};
    if (env.OPENAI_API_KEY) {
      try {
        const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const r = await fetchTimeout(fetchFn, `${base}/models/${encodeURIComponent(out.model)}`, { headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY } }, 8000);
        out.deep.openai = r.ok ? 'ok' : `error ${r.status} (check the key and OPENAI_MODEL)`;
      } catch { out.deep.openai = 'unreachable'; }
    }
    if (notionReady(env)) {
      const base = (env.NOTION_BASE_URL || 'https://api.notion.com').replace(/\/+$/, '');
      for (const [k, id] of [['notionResults', env.NOTION_RESULTS_DB], ['notionFeedback', env.NOTION_FEEDBACK_DB]]) {
        try {
          const r = await fetchTimeout(fetchFn, `${base}/v1/databases/${id}`, { headers: { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28' } }, 8000);
          out.deep[k] = r.ok ? 'ok' : `error ${r.status} (is the database shared with the integration?)`;
        } catch { out.deep[k] = 'unreachable'; }
      }
    }
  }
  return json(out);
}
