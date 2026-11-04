// Cognita front end: hash router, event handling, and the analysis flow.
// No framework. Screens are plain template strings from views.js; events are delegated
// (data-go / data-act) because the Content-Security-Policy forbids inline handlers.

import * as store from './store.js';
import * as api from './api.js';
import * as V from './views.js';
import { CAREER_BY_ID, FIELD_BY_ID } from '../../shared/careers.mjs';
import { rulesResult, validateInput, looksLikeResult, scoreAreas, isFlat, modeOf } from '../../shared/engine.mjs';
import { LIMITS, MODES } from '../../shared/config.mjs';
import { STARTER_IDS } from '../../shared/skills.mjs';

let S = store.load();
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const persist = () => store.save(S);
const CODE_RE = /^COG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// The current screen lives in the address (#/results). The one-file demo build sets
// window.COGNITA_MEMORY_ROUTER because it runs inside a frame that does not carry such addresses.
const MEMORY = !!window.COGNITA_MEMORY_ROUTER;
let memoryHash = '';
const getHash = () => (MEMORY ? memoryHash : location.hash);
const setHash = h => { if (MEMORY) { memoryHash = '#' + h; render(true); } else location.hash = h; };
const replaceHash = h => { if (MEMORY) { memoryHash = '#' + h; render(true); } else location.replace('#' + h); };

let runId = 0;        // bumps whenever the analysis screen is left, so a late answer is ignored
let sel = null;       // selected roadmap step
let openMsg = '', openBusy = false, openValue = '';
let startErr = false;
let flatAsk = false;  // the "your answers are almost all the same" question on the last statement
let flatOk = false;   // the person chose to see matches anyway
const ex = { q: '', f: '' };   // careers explorer: search text and field filter
let advance = 0;      // timer for auto-advance on the test screen
let pendingAt = -1;   // statement that is waiting for that timer, or -1

/* ---------- small helpers ---------- */

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function route() {
  const raw = getHash().replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });
  return { parts, q: new URLSearchParams(qs || '') };
}

const go = to => { if (getHash() === '#' + to) render(); else setHash(to); };
const firstUnanswered = () => S.answers.findIndex(a => a === null);
const allAnswered = () => firstUnanswered() === -1;
/** The profile part of the request, for the chosen path only. */
function profileInput() {
  const p = S.profile;
  if (modeOf(p) === 'pro') return { mode: 'pro', field: p.field, exp: p.exp, edu: p.edu, goal: p.goal, skills: p.skills.slice() };
  return { mode: 'student', grade: p.grade, subjects: p.subjects.slice(), skills: p.skills.filter(id => STARTER_IDS.includes(id)) };
}
const sameProfile = (a, b) => {
  const norm = p => JSON.stringify(Object.keys(p).sort().map(k => [k, Array.isArray(p[k]) ? [...p[k]].sort() : p[k]]));
  return norm({ mode: 'student', ...a }) === norm({ mode: 'student', ...b });
};

/** True if the saved result already matches the current answers, profile and AI choice. */
function resultIsCurrent() {
  const r = S.result;
  if (!r || !r.answers || r.where === 'device') return false;
  const sameAnswers = r.answers.length === 30 && r.answers.every((a, i) => a === S.answers[i]);
  const sameAi = (r.aiStatus === 'ok' && S.consent.ai) || (r.aiStatus === 'off' && !S.consent.ai);
  return sameAnswers && sameProfile(r.profile, profileInput()) && sameAi;
}

/* ---------- rendering ---------- */

const GATED = new Set(['type', 'profile', 'test', 'analysis']);     // screens that collect data need the Privacy Notice ticked
const NEEDS_RESULT = new Set(['results', 'why', 'delay']);

function titleFor(name, arg) {
  const t = {
    home: 'Cognita: AI career navigation', start: 'Get started', type: 'Your path', profile: 'Your profile', careers: 'Explore careers',
    test: 'Assessment', analysis: 'Analysing your answers', delay: 'The AI is taking longer than usual', results: 'Your career matches',
    dashboard: 'Dashboard', roadmap: 'My roadmap', open: 'Open a saved result', privacy: 'Privacy Notice', career: 'Career details', why: 'Why it fits',
  }[name] || 'Page not found';
  const c = arg && CAREER_BY_ID[arg];
  const label = (name === 'career' || name === 'why' || name === 'roadmap') && c ? `${t}: ${c.name}` : t;
  return name === 'home' ? label : `${label} · Cognita`;
}

function view(name, arg, q) {
  switch (name) {
    case 'home': return V.home(S);
    case 'start': return V.start(S, startErr);
    case 'type': return V.type(S);
    case 'careers': return V.careers(S, ex);
    case 'profile': return V.profile(S);
    case 'test': return V.test(S, flatAsk);
    case 'analysis': return V.analysis(S);
    case 'delay': return V.delay(S);
    case 'results': return V.results(S);
    case 'why': return V.why(S, arg);
    case 'dashboard': return V.dashboard(S);
    case 'career': return V.career(S, arg);
    case 'roadmap': return V.roadmap(S, arg || V.focusId(S), sel);
    case 'open': return V.open(S, openMsg, openBusy);
    case 'privacy': return V.privacy();
    default: return null;
  }
}

/** Draw the current route. fresh=true means we arrived here (scroll to top, move focus). */
function render(fresh = true) {
  const { parts, q } = route();
  let name = parts[0] || 'home';
  let arg = parts[1];

  if (name === 'r' && arg) { name = 'open'; openValue = arg; }       // /r/<CODE> deep link
  if (fresh) { runId++; clearTimeout(advance); pendingAt = -1; if (name !== 'test') flatAsk = false; }

  // guards: send people to the step they are missing instead of showing a broken screen
  let redirect = null;
  if (GATED.has(name) && !S.consent.privacy) redirect = '/start';
  else if (name === 'analysis' && !allAnswered()) redirect = '/test';
  else if (NEEDS_RESULT.has(name) && !S.result) redirect = allAnswered() || S.answers.some(a => a !== null) ? (S.consent.privacy ? '/test' : '/start') : '/start';
  else if (name === 'why' && !(S.result && S.result.matches.some(m => m.id === arg))) redirect = S.result ? '/results' : '/start';
  else if (name === 'delay' && S.result && !['timeout', 'error'].includes(S.result.aiStatus)) redirect = '/results';
  if (redirect) { replaceHash(redirect); return; }

  if (fresh) sel = name === 'roadmap' ? q.get('s') : null;
  if (name === 'career' && !CAREER_BY_ID[arg]) arg = null;
  if (name === 'roadmap' && arg && !CAREER_BY_ID[arg]) arg = null;
  if (name === 'roadmap' && !arg && !fresh) arg = V.focusId(S);

  if (name === 'test' && fresh) {
    if (S.q < 0 || S.q > 29) S.q = 0;
  }
  if (name === 'careers' && fresh) {
    const f = q.get('f') || '';
    ex.f = FIELD_BY_ID[f] ? f : '';
  }
  if (name === 'roadmap' && arg) S.focus = arg;
  if (name === 'career' && arg && S.result) S.focus = arg;

  let html = name === 'career' && !arg ? null : view(name, arg, q);
  let screen = name;
  if (html == null) { html = V.notFound(); screen = 'notfound'; }

  const y = fresh ? 0 : window.scrollY;
  document.body.dataset.screen = screen;
  document.body.classList.toggle('hastab', ['dashboard', 'career', 'roadmap'].includes(screen));
  document.title = titleFor(screen === 'notfound' ? 'x' : name, arg);
  app.innerHTML = html;
  window.scrollTo(0, y);
  if (fresh) {
    const h = app.querySelector('h1, h2');
    const target = app.querySelector('#main') || app;
    target.setAttribute('tabindex', '-1');
    (h || target).setAttribute('tabindex', '-1');
    (h || target).focus({ preventScroll: true });
  }

  if (name === 'analysis') startAnalysis();
  if (name === 'open') {
    const input = app.querySelector('#f-code');
    if (input) input.value = openValue;
    if (parts[0] === 'r' && arg && fresh) submitCode(arg);
  }
  if (name === 'test' && fresh) focusScale();
  if (name === 'dashboard' || name === 'results') persist();
}

function refresh(focusSel) {
  render(false);
  if (focusSel) { const el = app.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
}

function focusScale() {
  const el = app.querySelector('.sc[tabindex="0"]');
  if (el) el.focus({ preventScroll: true });
}

/* ---------- the analysis flow ---------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function setStep(i) {
  for (let k = 0; k < 4; k++) {
    const li = document.getElementById('a' + k);
    if (li) li.className = k < i ? 'done' : k === i ? 'now' : '';
  }
  const label = document.getElementById('anStep');
  if (label) label.textContent = `Step ${Math.min(i + 1, 4)} of 4`;
}

async function startAnalysis() {
  const id = ++runId;
  const alive = () => id === runId && route().parts[0] === 'analysis';
  const t0 = Date.now();
  setStep(0);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    app.querySelectorAll('.meter i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; });
  }));

  const body = {
    answers: S.answers.slice(),
    profile: profileInput(),
    note: S.consent.ai ? S.profile.note : '',
    useAi: S.consent.ai,
    save: S.consent.save,
  };
  const call = api.match(body).then(res => ({ res }), error => ({ error }));

  // the steps move on a timer so a fast answer still feels readable; the last step waits for the real answer
  await sleep(1300); if (!alive()) return; setStep(1);
  await sleep(1200); if (!alive()) return; setStep(2);
  const out = await call;
  const wait = 3600 - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
  if (!alive()) return;
  setStep(3);
  await sleep(350);
  if (!alive()) return;

  if (out.res && looksLikeResult(out.res.result)) {
    S.result = { ...out.res.result, answers: body.answers.slice() };
    S.code = out.res.code || null;
    S.saveStatus = out.res.saveStatus || 'off';
  } else {
    // The server could not be used (offline, busy, or a server error): work it out here with the shared rules.
    const status = out.error && out.error.status;
    const v = validateInput(body);
    const input = v.ok ? v.value : { ...body, note: '' };
    S.result = { ...rulesResult(input, status === 429 ? 'busy' : 'unreachable', 'device'), answers: body.answers.slice() };
    S.code = null;
    S.saveStatus = 'off';
  }
  S.focus = S.result.matches[0].id;
  persist();
  const slow = S.result.source === 'rules' && ['timeout', 'error'].includes(S.result.aiStatus);
  go(slow ? '/delay' : '/results');
}

/* ---------- open by code ---------- */

function normaliseCode(text) {
  const raw = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length === 15 && raw.startsWith('COG')) return `COG-${raw.slice(3, 7)}-${raw.slice(7, 11)}-${raw.slice(11, 15)}`;
  return String(text || '').trim().toUpperCase();
}

async function submitCode(text) {
  const code = normaliseCode(text);
  openValue = code;
  if (!CODE_RE.test(code)) { openMsg = 'That code does not look right. It has the form COG-XXXX-XXXX-XXXX.'; openBusy = false; if (route().parts[0] !== 'open') replaceHash('/open'); else refresh('#f-code'); return; }
  openMsg = ''; openBusy = true;
  if (route().parts[0] === 'r') replaceHash('/open'); else refresh();
  try {
    const res = await api.loadResult(code);
    const r = res.result;
    if (!looksLikeResult(r) || !Array.isArray(r.answers) || r.answers.length !== 30) throw new Error('That saved result could not be read.');
    S.answers = r.answers.slice();
    S.profile = { ...S.profile, ...r.profile, mode: modeOf(r.profile), subjects: (r.profile.subjects || S.profile.subjects).slice(), skills: r.profile.skills.slice(), note: '' };
    S.result = r; S.code = code; S.saveStatus = 'saved'; S.focus = r.matches[0].id; S.q = 0;
    persist();
    openBusy = false; openMsg = '';
    toast('Result opened.');
    go('/results');
  } catch (e) {
    openBusy = false;
    openMsg = e.status === 0 ? 'Could not reach the server. Check your connection and try again.' : e.message;
    if (route().parts[0] === 'open') refresh('#f-code'); else go('/open');
  }
}

/* ---------- actions ---------- */

const ACTIONS = {
  consent(el) {
    const k = el.dataset.k;
    S.consent[k] = !S.consent[k];
    if (k === 'privacy' && S.consent.privacy) startErr = false;
    persist();
    refresh(`[data-act=consent][data-k=${k}]`);
  },
  startNext() {
    const n = app.querySelector('#f-name');
    if (n) S.name = n.value.trim().slice(0, 30);
    persist();
    if (!S.consent.privacy) { startErr = true; refresh('[data-act=consent][data-k=privacy]'); return; }
    startErr = false;
    go('/type');
  },
  toggle(el) {
    const list = el.dataset.k === 'subject' ? S.profile.subjects : S.profile.skills;
    const id = el.dataset.id;
    const i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    persist();
    const on = i === -1;
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', String(on));
  },
  toTest() {
    const f = firstUnanswered();
    S.q = f === -1 ? 0 : f;
    persist();
    go('/test');
  },
  ans(el) {
    const v = Number(el.dataset.v);
    answer(v);
  },
  prevq() {
    clearTimeout(advance); pendingAt = -1;
    if (S.q > 0) { S.q--; persist(); refresh(); focusScale(); }
  },
  finish() {
    persist();
    if (!flatOk && isFlat(scoreAreas(S.answers))) { flatAsk = true; refresh('[data-act=review]'); return; }
    go(resultIsCurrent() ? '/results' : '/analysis');
  },
  finishAnyway() { flatAsk = false; flatOk = true; ACTIONS.finish(); },
  review() { flatAsk = false; S.q = 0; persist(); refresh(); focusScale(); },
  pickPath(el) {
    S.profile.mode = el.dataset.mode; persist();
    go(S.consent.privacy ? '/profile' : '/start');
  },
  mode(el) {
    if (!MODES.includes(el.dataset.mode)) return;
    S.profile.mode = el.dataset.mode; persist();
    refresh(`[data-act=mode][data-mode=${el.dataset.mode}]`);
  },
  goal(el) {
    S.profile.goal = el.dataset.id; persist();
    refresh(`[data-act=goal][data-id=${el.dataset.id}]`);
  },
  field(el) {
    ex.f = FIELD_BY_ID[el.dataset.id] ? el.dataset.id : '';
    if (!MEMORY) history.replaceState(null, '', '#/careers' + (ex.f ? '?f=' + ex.f : ''));
    refresh(`[data-act=field][data-id="${ex.f}"]`);
  },
  tryAi() { go('/analysis'); },
  adjust() { S.q = 0; persist(); go('/test'); },
  roadmapFor(el) { S.focus = el.dataset.id; persist(); go('/roadmap/' + el.dataset.id); },
  step(el) { sel = el.dataset.id; refresh(`[data-act=step][data-id="${sel}"]`); },
  mark(el) {
    const id = V.focusId(S);
    const rm = S.roadmap[id] || (S.roadmap[id] = { done: [] });
    const sid = el.dataset.id;
    const i = rm.done.indexOf(sid);
    if (i === -1) rm.done.push(sid); else rm.done.splice(i, 1);
    persist();
    sel = null;
    refresh();
    toast(i === -1 ? 'Step marked as done.' : 'Step marked as not done.');
  },
  async fb(el) {
    const id = el.dataset.id, v = Number(el.dataset.v);
    const key = (S.code || 'DEVICE') + ':' + id;
    if (S.feedback[key]) { toast('You already sent feedback for this career. Thank you!'); return; }
    S.feedback[key] = v; persist(); refresh();
    try { await api.sendFeedback({ code: S.code || 'DEVICE', rating: v, career: id }); toast('Thank you for your feedback!'); }
    catch (e) { delete S.feedback[key]; persist(); refresh(); toast(e.status === 0 ? 'Could not send feedback. Check your connection.' : e.message); }
  },
  async copy() {
    if (!S.code) return;
    try { await navigator.clipboard.writeText(S.code); toast('Code copied.'); }
    catch {
      const el = document.getElementById('codeText');
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast('Press Ctrl+C (or Cmd+C) to copy the code.');
    }
  },
  exit() { persist(); toast('Progress saved on this device.'); go('/'); },
  back() { if (history.length > 1) history.back(); else go('/'); },
  wipe(el) {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Click again to confirm'; return; }
    store.wipe(); S = store.fresh(); startErr = false; toast('Everything stored in this browser was cleared.'); go('/');
  },
};

function answer(v, viaKey = false) {
  if (!(v >= 0 && v <= 4)) return;
  // A fast typist presses the next key before the short "selected" pause is over:
  // move on right away so that every key press counts for its own statement.
  if (viaKey && pendingAt >= 0) {
    clearTimeout(advance);
    if (S.q === pendingAt && S.q < 29) S.q = pendingAt + 1;
    pendingAt = -1;
  }
  S.answers[S.q] = v;
  flatAsk = false; flatOk = false;
  persist();
  refresh();
  focusScale();
  clearTimeout(advance);
  if (S.q < 29) {
    const at = S.q;
    pendingAt = at;
    advance = setTimeout(() => {
      pendingAt = -1;
      if (route().parts[0] !== 'test' || S.q !== at) return;
      S.q = at + 1; persist(); refresh(); focusScale();
    }, 240);
  } else {
    pendingAt = -1;
    const b = app.querySelector('[data-act=finish]');
    if (b) b.focus({ preventScroll: true });
  }
}

/* ---------- events ---------- */

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act],[data-scroll]');
  if (!t || t.disabled) return;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  if (t.dataset.scroll) {
    const el = document.getElementById(t.dataset.scroll);
    if (el) { el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    return;
  }
  const fn = ACTIONS[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t); }
});

function onField(e) {
  const t = e.target;
  if (!t.dataset || !t.dataset.f) return;
  if (t.dataset.f === 'name') S.name = t.value.slice(0, 30);
  else if (t.dataset.f === 'grade') S.profile.grade = t.value;
  else if (['field', 'exp', 'edu'].includes(t.dataset.f)) S.profile[t.dataset.f] = t.value;
  else if (t.dataset.f === 'search') {
    ex.q = t.value.slice(0, 60);
    const grid = document.getElementById('cgrid');
    if (grid) grid.innerHTML = V.careerGrid(S, ex);
    return;
  }
  else if (t.dataset.f === 'note') {
    S.profile.note = t.value.slice(0, LIMITS.noteMax);
    const c = document.getElementById('note-count');
    if (c) c.textContent = `${S.profile.note.length}/${LIMITS.noteMax}`;
  }
  persist();
}
document.addEventListener('input', onField);
document.addEventListener('change', onField);

document.addEventListener('submit', e => {
  if (e.target.dataset && e.target.dataset.form === 'code') {
    e.preventDefault();
    const v = e.target.querySelector('input').value;
    submitCode(v);
  }
});

document.addEventListener('keydown', e => {
  // test screen: 1-5 pick an answer; arrow keys move between the five circles
  if (route().parts[0] !== 'test' || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (/^[1-5]$/.test(e.key)) { e.preventDefault(); answer(Number(e.key) - 1, true); return; }
  if (e.target.classList && e.target.classList.contains('sc') && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    const all = [...app.querySelectorAll('.sc')];
    const i = all.indexOf(e.target);
    const n = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
    all.forEach(b => b.setAttribute('tabindex', b === n ? '0' : '-1'));
    n.focus();
  }
});

window.addEventListener('hashchange', () => render(true));
render(true);
