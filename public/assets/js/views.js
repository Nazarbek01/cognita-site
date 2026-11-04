// Screens. Each view takes the saved state S (and a parameter) and returns an HTML string.
// Anything that came from outside the code (name, AI sentences, codes, search text) goes through esc().

import { AREAS, SCALE, GRADES, SUBJECTS, EXPERIENCE, EDUCATION, GOALS, LIMITS, WEIGHTS, SHAPE_SHARE } from '../../shared/config.mjs';
import { QUESTIONS } from '../../shared/questions.mjs';
import { CAREERS, CAREER_BY_ID, FIELDS, FIELD_BY_ID, careersIn } from '../../shared/careers.mjs';
import { SKILLS, SKILL_GROUPS, STARTER_IDS, SKILL_IDS } from '../../shared/skills.mjs';
import { scoreAreas, skillGap, topAreasFor, matchFacts, rulesSummary, strongestAreas, isFlat, modeOf } from '../../shared/engine.mjs';
import { SITE } from './site.config.js';
import { ic, CK, LOCK, ARROW } from './icons.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
const N_CAREERS = CAREERS.length, N_FIELDS = FIELDS.length;

/* ---------- pictures ---------- */

// The one-file demo build puts every picture into window.COGNITA_ASSETS as a data: address.
const asset = path => (window.COGNITA_ASSETS && window.COGNITA_ASSETS[path]) || path;
export const pic = (slug, size, cls = '', alt = '') =>
  `<img class="pic ${cls}" src="${asset('/assets/img/3d/' + slug + '.webp')}" width="${size}" height="${size}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
const hueVars = fieldId => { const h = FIELD_BY_ID[fieldId].hue; return `--h:var(--hue-${h});--hd:var(--hue-${h}-deep);--ht:var(--hue-${h}-tint)`; };
const tile = (c, size = 56, cls = '') => `<span class="tile3d ${cls}" style="${hueVars(c.field)}">${pic(c.img, size)}</span>`;

/* ---------- shared pieces ---------- */

const brand = (extra = '') => `<button class="brand ${extra}" data-go="/" aria-label="Cognita, home"><img class="mark" src="${asset('/assets/img/brand/cognita-mark.webp')}" width="36" height="39" alt=""><img class="word" src="${asset('/assets/img/brand/cognita-wordmark.webp')}" width="124" height="16" alt=""></button>`;
const demoNote = () => (window.COGNITA_DEMO
  ? `<div class="banner warn" role="note"><span class="bi">${ic('info', 20)}</span><div><b>Demo version</b>This copy runs only in your browser. The AI and saving a result under a code need a server, so they are switched off here and matches are calculated on your device.</div></div>`
  : '');
const EXIT = '<button class="link" data-act="exit">Save &amp; exit</button>';

function nav(S, extra) {
  const done = !!(S && S.result);
  const links = `<button class="nlink hide-sm" data-go="/careers">Careers</button><button class="nlink hide-sm" data-scroll="how">How it works</button><button class="nlink hide-md" data-scroll="ai">AI &amp; privacy</button><button class="nlink hide-md" data-go="/open">Open my result</button>`;
  const cta = `<button class="btn go sm" data-go="${done ? '/dashboard' : '/start'}">${done ? 'My dashboard' : 'Start the test'}</button>`;
  return `<header class="topnav">${brand()}<nav class="nlinks" aria-label="Site">${extra === undefined ? links + cta : extra}</nav></header>`;
}
const topbar = extra => `<header class="topnav slim">${brand()}<div class="nlinks">${extra || ''}</div></header>`;

const footer = () => `<footer class="foot"><div class="fcols">
  <div class="fbrand">${brand('sm')}<p>Career guidance for students and professionals. Made by team Cognita, students of Astana IT University.</p></div>
  <div><b>Explore</b><button class="link" data-go="/careers">All ${N_CAREERS} careers</button><button class="link" data-go="/start">Take the assessment</button><button class="link" data-go="/open">Open a saved result</button></div>
  <div><b>About</b><button class="link" data-go="/privacy">Privacy Notice</button><span class="fnote">3D pictures: <a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noopener noreferrer">Microsoft Fluent Emoji</a> (MIT licence)</span></div></div>
  <p class="fdis">Cognita is a guidance tool, not a psychological test or professional career counselling. Matches are suggestions, not decisions.</p></footer>`;

function stepper(active) {
  const L = ['Start', 'Your path', 'Profile', 'Assessment'];
  return `<ol class="stepper" aria-label="Progress">${L.map((l, i) => {
    const n = i + 1; const cls = n < active ? 'done' : n === active ? 'now' : '';
    return `<li class="${cls}" ${n === active ? 'aria-current="step"' : ''}><i>${n < active ? CK : n}</i><span>${l}</span></li>`;
  }).join('')}</ol>`;
}

export const focusId = S => (S.focus && CAREER_BY_ID[S.focus]) ? S.focus : (S.result ? S.result.matches[0].id : CAREERS[0].id);
const ownedSkills = S => (S.result ? S.result.profile.skills : S.profile.skills);
const matchOf = (S, id) => S.result && S.result.matches.find(m => m.id === id);
const pathLabel = p => (modeOf(p) === 'pro' ? 'Professional' : 'Student');

const sourceChip = S => {
  const r = S.result; if (!r) return '';
  if (r.where === 'device') return '<span class="chip dev">Calculated on this device</span>';
  return r.source === 'ai' ? `<span class="chip ai">${ic('spark', 14)} AI-explained</span>` : '<span class="chip dev">Calculated by rules</span>';
};

function shell(S, active, inner) {
  const f = focusId(S);
  const items = [
    ['/dashboard', 'Dashboard', 'dashboard', 'home'],
    ['/results', 'My matches', 'results', 'list'],
    ['/careers', 'Explore careers', 'careers', 'grid'],
    ['/career/' + f, 'Career details', 'career', 'card'],
    ['/roadmap/' + f, 'My roadmap', 'roadmap', 'route'],
  ];
  const side = items.map(([to, n, id, icon]) => `<button data-go="${to}" ${id === active ? 'aria-current="page"' : ''} ${id === 'results' && !S.result ? 'disabled' : ''}>${ic(icon, 20)}<span>${n}</span></button>`).join('')
    + `<button disabled>${ic('chart', 20)}<span>Market analytics</span><em>Soon</em></button>`
    + `<button disabled>${ic('flame', 20)}<span>Quests &amp; rewards</span><em>Soon</em></button>`
    + `<button data-go="/privacy" ${active === 'privacy' ? 'aria-current="page"' : ''}>${ic('lock', 20)}<span>Privacy</span></button>`;
  const who = S.name ? esc(S.name) : (S.result ? pathLabel(S.result.profile) : 'Guest');
  const initials = esc((S.name || who).trim().slice(0, 2).toUpperCase());
  const sub = S.result ? (modeOf(S.result.profile) === 'pro' ? 'Professional path' : (/^\d+$/.test(S.result.profile.grade) ? 'Grade ' + esc(S.result.profile.grade) : esc(S.result.profile.grade))) : 'No result yet';
  const tabs = [['/dashboard', 'Home', 'dashboard', 'home'], ['/results', 'Matches', 'results', 'list'], ['/careers', 'Careers', 'careers', 'grid'], ['/roadmap/' + f, 'Roadmap', 'roadmap', 'route'], ['/privacy', 'Privacy', 'privacy', 'lock']]
    .map(([to, n, id, icon]) => `<button data-go="${to}" ${id === active ? 'aria-current="page"' : ''} ${id === 'results' && !S.result ? 'disabled' : ''}>${ic(icon, 20)}<span>${n}</span></button>`).join('');
  return `<div class="wrap"><div class="app"><aside class="side">${brand()}<nav aria-label="Main menu">${side}</nav><div class="me"><b>${initials}</b><span>${who}<small>${sub}</small></span></div></aside><main id="main"><div class="mtop">${brand()}</div>${inner}${footer()}</main></div></div>
  <nav class="tabbar" aria-label="Main menu">${tabs}</nav>`;
}

/* ---------- landing ---------- */

const heroArt = () => {
  const floaters = [
    ['woman-technologist', 'f1'], ['health-worker', 'f2'], ['artist-palette', 'f3'], ['woman-pilot', 'f4'],
    ['rocket', 'f5'], ['man-cook', 'f6'], ['microscope', 'f7'], ['balance-scale', 'f8'],
  ];
  return `<div class="hero-art" aria-hidden="true">
    <div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
    <img class="bigmark" src="${asset('/assets/img/brand/cognita-mark.webp')}" width="227" height="246" alt="">
    ${floaters.map(([s, c]) => `<span class="float ${c}">${pic(s, 72)}</span>`).join('')}
    <div class="glass g1"><small>Example match</small><div class="gm">${pic('computer-mouse', 40)}<b>UX/UI Designer</b><span>82%</span></div><div class="bar"><i style="width:82%"></i></div></div>
    <div class="glass g2"><small>Next skill</small><b>User research</b></div></div>`;
};

const feature = (img, title, state, text) =>
  `<article class="feat ${state}">${pic(img, 64)}<div><span class="fstate ${state}">${state === 'live' ? 'Live' : 'Coming soon'}</span><h3>${title}</h3><p>${text}</p></div></article>`;
const how = (n, img, title, text) => `<li class="hstep">${pic(img, 72)}<span class="hn">${n}</span><h3>${title}</h3><p>${text}</p></li>`;
const faq = (q, a) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`;

export function home(S) {
  const started = S.answers.some(a => a !== null);
  const done = !!S.result;
  const cta = done ? ['Open my dashboard', '/dashboard'] : started ? ['Continue where you left off', '/test'] : ['Start the free assessment', '/start'];
  const fieldTiles = FIELDS.map(f => `<button class="ftile" style="--h:var(--hue-${f.hue});--hd:var(--hue-${f.hue}-deep);--ht:var(--hue-${f.hue}-tint)" data-go="/careers?f=${f.id}">${pic(f.img, 56)}<b>${f.name}</b><small>${careersIn(f.id).length} careers</small></button>`).join('');
  return `<div class="wrap">${nav(S)}
 <main id="main">
 ${demoNote()}
 <section class="hero">
  <div class="hero-copy"><span class="eyebrow">${ic('spark', 16)} AI career navigator</span>
   <h1>Find the career that <span class="grad">fits&nbsp;you</span>.</h1>
   <p class="lead">Answer 30 short statements. Cognita compares your interests and skills with ${N_CAREERS} careers in ${N_FIELDS} fields, then shows your top five, each with a reason, the skills you are missing and a step-by-step roadmap.</p>
   <div class="cta"><button class="btn go lg" data-go="${cta[1]}">${cta[0]} ${ARROW}</button><button class="btn ghost lg" data-go="/careers">Explore careers</button></div>
   <ul class="ticks"><li>${CK} About 5 minutes</li><li>${CK} No account, no email</li><li>${CK} For students and professionals</li></ul></div>
  ${heroArt()}
 </section>

 <section class="stats" aria-label="Cognita in numbers">
  <div><b>${N_CAREERS}</b><span>careers described</span></div><div><b>${N_FIELDS}</b><span>fields of work</span></div><div><b>30</b><span>short statements</span></div><div><b>5</b><span>matches, each with a reason</span></div></section>

 <section class="sect" id="paths"><span class="kicker">Two paths</span><h2>Made for where you are now</h2>
  <div class="paths">
   <article class="pathc stu">${pic('woman-student', 120, 'pp')}<div><h3>I’m a student</h3><p>For school and university students aged 15–22 who want to know which careers fit them and what to learn first.</p>
    <ul class="ticks v"><li>${CK} Your year at school and favourite subjects</li><li>${CK} Skills you already have</li><li>${CK} A roadmap from today</li></ul>
    <button class="btn go" data-act="pickPath" data-mode="student">Start as a student ${ARROW}</button></div></article>
   <article class="pathc pro">${pic('man-office-worker', 120, 'pp')}<div><h3>I’m a professional</h3><p>For people who already work and want to grow in their field or move to a new one.</p>
    <ul class="ticks v"><li>${CK} Your field, experience and education</li><li>${CK} Your real skills count more</li><li>${CK} Grow where you are, or change direction</li></ul>
    <button class="btn pinkb" data-act="pickPath" data-mode="pro">Start as a professional ${ARROW}</button></div></article></div></section>

 <section class="sect" id="fields"><span class="kicker">Explore</span><h2>${N_FIELDS} fields, ${N_CAREERS} careers</h2><p class="sub">From medicine to game development, from law to welding. Tap a field to see its careers.</p>
  <div class="fgrid">${fieldTiles}</div>
  <div class="center"><button class="btn ghost" data-go="/careers">See all ${N_CAREERS} careers ${ARROW}</button></div></section>

 <section class="sect" id="how"><span class="kicker">How it works</span><h2>From “Who am I?” to “What next?”</h2>
  <ol class="hsteps">${how(1, 'memo', 'Answer 30 statements', 'About your interests, plus your studies or work and the skills you have.')}${how(2, 'crystal-ball', 'Get your matches', `Your answers are compared with ${N_CAREERS} career profiles. The AI explains each match.`)}${how(3, 'bullseye', 'See why it fits', 'Every match shows the scores, skills and answers behind it.')}${how(4, 'puzzle-piece', 'Find your skill gap', 'See which skills you have and which ones to build next.')}${how(5, 'world-map', 'Follow your roadmap', 'One step for each missing skill, then a real project. Mark steps as done.')}</ol></section>

 <section class="sect" id="features"><span class="kicker">Features</span><h2>What you can use today</h2><p class="sub">Live means you can use it now. Coming soon means it is planned and clearly marked.</p>
  <div class="feats">${feature('memo', 'AI Career Assessment', 'live', 'Top five careers with a match percentage and a reason for each.')}${feature('puzzle-piece', 'Skill-Gap Analysis', 'live', 'The skills you have and the ones you still need, in priority order.')}${feature('world-map', 'Personal Roadmap', 'live', 'A step-by-step route to the career you choose, with progress you can mark.')}${feature('chart-increasing', 'Market Analytics', 'soon', 'Salaries and demand in Kazakhstan. Every number will show its source and date.')}${feature('trophy', 'Quests &amp; Rewards', 'soon', 'Daily tasks linked to your roadmap, with streaks and badges.')}${feature('bar-chart', 'Weakness Analytics', 'soon', 'Practice quizzes that find the topics you need to work on.')}</div></section>

 <section class="sect" id="ai"><span class="kicker">AI &amp; privacy</span><h2>Helpful, limited and under your control</h2>
  <div class="g3">
   <article class="card icard">${pic('robot', 64)}<h3>What the AI does</h3><p>Your 30 answers become six interest scores. The AI reads them with your profile and skills, picks five careers from the best candidates and writes a short reason for each. It may move a match by at most 15 points.</p></article>
   <article class="card icard">${pic('locked', 64)}<h3>What it never gets</h3><p>Your name, email and birth date are never asked for and never sent. An optional note has email addresses and phone numbers removed first, and it is not saved on our side.</p></article>
   <article class="card icard">${pic('key', 64)}<h3>What you control</h3><p>Switch the AI off and get matches from simple, open rules. Save your result under a private code only if you want to. Change your answers at any time.</p></article></div></section>

 <section class="sect" id="faq"><span class="kicker">Questions</span><h2>Good to know</h2>
  <div class="faqs">
   ${faq('Is Cognita a psychological test?', 'No. The 30 statements were written by the Cognita team. Cognita is a guidance tool that helps you explore careers. It is not a validated psychological test and not professional career counselling.')}
   ${faq('Do I need an account?', 'No. There is no account, password or email. Your progress stays in your browser. If you want, you can save your result under a private code and open it on another device.')}
   ${faq('Where do the careers come from?', `The Cognita team wrote ${N_CAREERS} career profiles in ${N_FIELDS} fields. How much each interest area matters for a career is our estimate, based on the Holland (RIASEC) interest types that are often used in career guidance. It is not official data.`)}
   ${faq('Why are there no salaries?', 'We show a number only when we have its source and the date it was checked. Market analytics with sources is planned. Until then we show no numbers.')}
   ${faq('I already work. Can I use Cognita?', 'Yes. Choose “I’m a professional”. You tell us your field, experience, education and goal, and your skills count more in the match.')}
   ${faq('Why do I see careers from different fields?', `Your top five include at most ${LIMITS.perField} careers from one field, so you see real options instead of five versions of the same job.`)}</div></section>

 <section class="final"><div>${pic('rocket', 96)}<h2>Your future shouldn’t be a guess.</h2><p>Five minutes, thirty statements, five careers with reasons.</p><button class="btn white lg" data-go="${cta[1]}">${cta[0]} ${ARROW}</button></div></section>
 ${footer()}</main></div>`;
}

/* ---------- careers explorer ---------- */

export function careerGrid(S, ex) {
  const q = (ex.q || '').trim().toLowerCase();
  const list = CAREERS.filter(c => (!ex.f || c.field === ex.f) && (!q || (c.name + ' ' + FIELD_BY_ID[c.field].name + ' ' + c.summary).toLowerCase().includes(q)));
  const cards = list.map(c => {
    const m = matchOf(S, c.id);
    return `<button class="ccard ${m ? 'hasm' : ''}" style="${hueVars(c.field)}" data-go="/career/${c.id}">${tile(c, 52)}<span class="cc"><b>${esc(c.name)}</b><small>${FIELD_BY_ID[c.field].name}</small><span class="cs">${esc(c.summary)}</span></span>${m ? `<span class="mchip">${m.match}%</span>` : ''}</button>`;
  }).join('');
  return `<p class="count" id="ccount" aria-live="polite">${list.length === CAREERS.length ? `All ${list.length} careers` : `${list.length} of ${CAREERS.length} careers`}</p>
  <div class="cgrid">${cards || `<div class="empty">${pic('thought-balloon', 72)}<p>No career matches “${esc(ex.q)}”. Try another word or choose “All fields”.</p></div>`}</div>`;
}

export function careers(S, ex) {
  const chip = (id, label, img) => `<button class="fchip ${ex.f === id ? 'on' : ''}" data-act="field" data-id="${id}" aria-pressed="${ex.f === id}">${img ? pic(img, 24) : ''}${label}</button>`;
  return `<div class="wrap">${nav(S)}<main id="main">
  <section class="xhead"><div><span class="kicker">Explore</span><h1 class="title">${ex.f ? esc(FIELD_BY_ID[ex.f].name) : `All ${N_CAREERS} careers`}</h1>
   <p class="sub">${ex.f ? esc(FIELD_BY_ID[ex.f].blurb) : `${N_FIELDS} fields, from medicine to game development. Open a career to see what people do, how they get there and which skills you need.`}</p></div>
   ${ex.f ? pic(FIELD_BY_ID[ex.f].img, 120, 'xpic') : pic('compass', 120, 'xpic')}</section>
  <div class="xbar"><label class="search">${ic('search', 20)}<span class="sr">Search careers</span><input id="f-search" data-f="search" type="search" placeholder="Search, for example “doctor” or “design”" value="${esc(ex.q)}" autocomplete="off"></label></div>
  <div class="fchips" role="group" aria-label="Filter by field">${chip('', 'All fields')}${FIELDS.map(f => chip(f.id, f.name, f.img)).join('')}</div>
  <div id="cgrid">${careerGrid(S, ex)}</div>
  ${S.result ? '' : `<div class="cta-band">${pic('bullseye', 64)}<div><b>Not sure where to start?</b><span>Take the assessment and see which of these careers fit you best.</span></div><button class="btn go" data-go="/start">Start the assessment ${ARROW}</button></div>`}
  ${footer()}</main></div>`;
}

/* ---------- onboarding ---------- */

const check = (k, on, title, desc, cls = '') => `<button class="check ${cls}" role="checkbox" aria-checked="${on}" data-act="consent" data-k="${k}"><span class="box">${on ? CK : ''}</span><span><b>${title}</b>${desc}</span></button>`;

export function start(S, err) {
  const c = S.consent;
  const form = `<div class="card form"><h1 class="title">Let’s get started</h1><p class="sub">No account and no password. Your progress stays in this browser, and you can get a private code to open your result later.</p>
  <div class="field"><label for="f-name">First name (optional)</label><input id="f-name" data-f="name" value="${esc(S.name)}" maxlength="30" autocomplete="given-name" placeholder="Used only to greet you"><span class="hint">Stays on this device. It is never sent anywhere.</span></div>
  ${check('privacy', c.privacy, 'I have read the Privacy Notice', 'What data Cognita collects, why, and for how long.', err ? 'bad' : '')}
  <div class="under"><button class="link" data-go="/privacy">Open the Privacy Notice</button></div>
  ${err ? '<p class="err" role="alert">Please confirm that you have read the Privacy Notice to continue.</p>' : ''}
  ${check('ai', c.ai, 'Use AI to explain my matches', 'My six interest scores, profile and skills (never my name or email) are sent to OpenAI. If this is off, matches are calculated by simple rules.')}
  ${check('save', c.save, 'Save my result under a private code', 'So I can open it later or on another device. Anyone with the code can see the result, so keep it private.')}
  <div class="row"><button class="btn go" data-act="startNext">Continue ${ARROW}</button></div></div>`;
  const side = `<aside class="ticket">${pic('compass', 88)}<h2>What happens next</h2><ol class="nxt"><li><b>Your path</b><span>Student or professional</span></li><li><b>Your profile</b><span>Studies or work, and your skills</span></li><li><b>30 statements</b><span>About 5 minutes</span></li><li><b>Your matches</b><span>5 careers, each with a reason</span></li></ol></aside>`;
  return `<div class="wrap">${topbar(`<button class="link" data-go="/open">Open my result</button>`)}<main id="main">${demoNote()}${stepper(1)}<div class="two">${form}${side}</div>${footer()}</main></div>`;
}

export function type(S) {
  const mode = modeOf(S.profile);
  const opt = (m, img, title, text) => `<button class="opt ${mode === m ? 'on' : ''}" role="radio" aria-checked="${mode === m}" data-act="mode" data-mode="${m}">${pic(img, 112)}<h3>${title}</h3><p>${text}</p><span class="sel">${mode === m ? CK + ' Selected' : 'Choose'}</span></button>`;
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(2)}<h1 class="title center">Which describes you best?</h1><p class="sub center">This sets up your profile questions and how your skills count.</p>
  <div class="pick" role="radiogroup" aria-label="Your path">${opt('student', 'woman-student', 'I’m a student', 'At school, college or university. I want to find careers that fit me and a plan to reach one.')}${opt('pro', 'man-office-worker', 'I’m a professional', 'I already work. I want to grow in my field or move to a new one.')}</div>
  <div class="row center"><button class="btn go" data-go="/profile">Continue ${ARROW}</button><button class="btn ghost" data-go="/start">Back</button></div>${footer()}</main></div>`;
}

const toggle = (k, id, label, on) => `<button class="toggle ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-act="toggle" data-k="${k}" data-id="${esc(id)}">${esc(label)}</button>`;
const select = (id, f, label, options, value) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-f="${f}">${options.map(([v, l]) => `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
const noteField = S => (S.consent.ai ? `<div class="field"><label for="f-note">Anything else the AI should know? (optional)</label><textarea id="f-note" data-f="note" maxlength="300" placeholder="For example: what you enjoy doing in your free time">${esc(S.profile.note)}</textarea><span class="hint">Do not write your name or contact details. Email addresses and phone numbers are removed before sending. This note is not saved on our side.</span><span class="count" id="note-count">${S.profile.note.length}/300</span></div>` : '');

export function profile(S) {
  const p = S.profile;
  const pro = modeOf(p) === 'pro';
  let body;
  if (!pro) {
    body = `<h1 class="title">Tell us about your studies</h1><p class="sub">Pick what fits. You can change it later.</p>
    ${select('f-grade', 'grade', 'Year at school', GRADES.map(g => [g, /^\d+$/.test(g) ? 'Grade ' + g : g]), p.grade)}
    <div class="field"><label>Subjects you like</label><div class="chips">${SUBJECTS.map(s => toggle('subject', s, s, p.subjects.includes(s))).join('')}</div></div>
    <div class="field"><label>Skills you already have</label><div class="chips">${STARTER_IDS.map(id => toggle('skill', id, SKILLS[id].name, p.skills.includes(id))).join('')}</div></div>`;
  } else {
    const groups = SKILL_GROUPS.map((g, i) => {
      const ids = SKILL_IDS.filter(id => SKILLS[id].group === g);
      const n = ids.filter(id => p.skills.includes(id)).length;
      return `<details class="sgroup" ${i < 2 || n ? 'open' : ''}><summary>${g}<span>${n ? n + ' selected' : ''}</span></summary><div class="chips">${ids.map(id => toggle('skill', id, SKILLS[id].name, p.skills.includes(id))).join('')}</div></details>`;
    }).join('');
    body = `<h1 class="title">Tell us about your work</h1><p class="sub">Pick what fits. Your real skills count for 30% of each match.</p>
    <div class="fields2">${select('f-field', 'field', 'The field you work in now', [...FIELDS.map(f => [f.id, f.name]), ['other', 'Other']], p.field)}
    ${select('f-exp', 'exp', 'Work experience', EXPERIENCE.map(e => [e, e]), p.exp)}
    ${select('f-edu', 'edu', 'Highest education', EDUCATION.map(e => [e, e]), p.edu)}</div>
    <div class="field"><label>What do you want?</label><div class="chips" role="radiogroup" aria-label="Your goal">${GOALS.map(g => `<button class="toggle ${p.goal === g.id ? 'on' : ''}" role="radio" aria-checked="${p.goal === g.id}" data-act="goal" data-id="${g.id}">${g.name}</button>`).join('')}</div></div>
    <div class="field"><label>Skills you already have</label>${groups}</div>`;
  }
  const left = `<div class="card form">${body}${noteField(S)}
  <div class="row"><button class="btn go" data-act="toTest">Continue to the assessment ${ARROW}</button><button class="btn ghost" data-go="/type">Back</button></div></div>`;
  const right = `<aside class="stack"><div class="card soft">${pic(pro ? 'man-office-worker' : 'woman-student', 80)}<h3>${pro ? 'Professional path' : 'Student path'}</h3><p class="muted">${pro ? 'Your interests count for 60%, your skills for 30% and your goal for 10% of each match.' : 'Your interests count for 70%, your skills for 20% and your favourite subjects for 10% of each match.'}</p><button class="link" data-go="/type">Change path</button></div>
  <div class="card soft">${pic('locked', 56)}<h3>Why we ask</h3><p class="muted">These answers are compared with career profiles together with your assessment. Your name, email and birth date are never asked for and never sent.</p></div></aside>`;
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(3)}<div class="two">${left}${right}</div>${footer()}</main></div>`;
}

/* ---------- assessment ---------- */

export function test(S, flatAsk) {
  const q = Math.min(Math.max(S.q, 0), 29);
  const cur = S.answers[q];
  const answered = S.answers.filter(a => a !== null).length;
  const all = answered === 30;
  const ask = flatAsk && all ? `<div class="banner warn flatask" role="alert"><span class="bi">${ic('warn', 20)}</span><div><b>Your answers are almost all the same</b>When every statement gets the same answer, there is no difference between your interest areas, so the matches would not mean much. You can go back and give each statement the answer that really fits you.<div class="row"><button class="btn sm go" data-act="review">Review my answers</button><button class="btn sm ghost" data-act="finishAnyway">See matches anyway</button></div></div></div>` : '';
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(4)}
  <div class="card q"><h1 class="sr">Assessment, statement ${q + 1} of 30</h1><div class="meta"><span>Statement ${q + 1} of 30</span><span>${all ? 'All answered' : (30 - answered) + ' to go'}</span></div>
   <div class="prog" aria-hidden="true"><i style="width:${Math.round((answered / 30) * 100)}%"></i></div>
   <h2 id="qtext">${esc(QUESTIONS[q].text)}</h2>
   <div class="scale" role="radiogroup" aria-labelledby="qtext">${SCALE.map((l, k) => `<button class="sc s${k} ${cur === k ? 'on' : ''}" role="radio" aria-checked="${cur === k}" data-act="ans" data-v="${k}" tabindex="${(cur === k || (cur === null && k === 0)) ? 0 : -1}"><i></i><span>${l}</span></button>`).join('')}</div>
   <p class="muted tip">Tip: press 1 to 5 on your keyboard. There are no right or wrong answers.</p>
   ${ask}
   <div class="qfoot"><button class="btn ghost" data-act="prevq" ${q === 0 ? 'disabled' : ''}>${ic('back', 18)} Previous</button>${all && !ask ? `<button class="btn go" data-act="finish">See my matches ${ARROW}</button>` : ''}</div></div>${footer()}</main></div>`;
}

export function analysis(S) {
  const areas = scoreAreas(S.answers.map(a => a ?? 0));
  const ai = S.consent.ai;
  const pro = modeOf(S.profile) === 'pro';
  return `<div class="wrap an">${topbar(ai ? `<span class="chip ai">${ic('spark', 14)} AI analysis</span>` : '<span class="chip dev">Rules only</span>')}<main id="main">${stepper(4)}
  <div class="two"><div class="card"><div class="chips mb"><span class="chip ${ai ? 'ai' : 'dev'}"><span class="spin"></span>${ai ? 'AI is working' : 'Working'}</span><span class="chip" id="anStep" aria-live="polite">Step 1 of 4</span></div>
   <h1>Analysing your 30 answers</h1><p class="sub">Your answers are saved on this device, so you can leave and come back.</p>
   <ol class="vroute">
    <li id="a0"><i></i><div><b>Scoring your answers on 6 interest areas</b><small>Each answer adds to one area. These are your real scores.</small>
      <div class="meters">${AREAS.map(a => `<div class="meter" style="--c:${a.color}"><span>${pic(a.img, 22)}${a.name}</span><span>${areas[a.id]}</span><div><i data-w="${areas[a.id]}"></i></div></div>`).join('')}</div></div></li>
    <li id="a1"><i></i><div><b>Comparing your profile with ${N_CAREERS} careers in ${N_FIELDS} fields</b><small>Interests, skills and ${pro ? 'your goal' : 'school subjects'} against each career.</small></div></li>
    <li id="a2"><i></i><div><b>${ai ? 'Writing “why it fits” explanations' : 'Preparing short explanations'}</b><small>A short reason for each top match.</small></div></li>
    <li id="a3"><i></i><div><b>Preparing your matches</b><small>Five careers, at most ${LIMITS.perField} from one field.</small></div></li></ol></div>
   <aside class="stack"><div class="card soft">${pic(ai ? 'robot' : 'gear', 64)}<h3>${ai ? 'What is sent to the AI' : 'What is sent to our server'}</h3>
    <ul class="sent">${ai ? `<li>${CK}Your six interest scores, worked out from your 30 answers</li>` : `<li>${CK}Your 30 answers, to calculate the matches</li>`}<li>${CK}${pro ? 'Your field, experience, education, goal and skills' : 'Your year, subjects and skills'}</li>${ai && S.profile.note ? `<li>${CK}Your optional note, with emails and phone numbers removed</li>` : ''}</ul>
    <div class="chips mb"><span class="chip ok">${LOCK} Never sent</span></div>
    <ul class="sent never"><li>Your name</li><li>Your email</li><li>Your birth date</li></ul></div></aside></div>${footer()}</main></div>`;
}

export function delay(S) {
  const st = S.result && S.result.aiStatus;
  const slow = st === 'timeout';
  return `<div class="wrap">${topbar('')}<main id="main"><div class="notice">${pic('hourglass-not-done', 96)}
   <span class="chip warn">Service notice</span>
   <h1>${slow ? 'The AI is taking longer than usual' : 'The AI could not answer right now'}</h1>
   <p class="sub">Your 30 answers are saved on this device. You can try the AI again, or see matches calculated by simple rules right away.</p>
   <p class="okline"><span class="chip ok">${CK}</span>Your answers stay saved. Nothing was lost.</p>
   <div class="row center"><button class="btn go" data-act="tryAi">Try again</button><button class="btn ghost" data-go="/results">Show rule-based matches</button></div></div>${footer()}</main></div>`;
}

/* ---------- results ---------- */

const AI_NOTE = {
  off: ['info', 'AI is off', 'These matches were calculated by simple rules from your scores, skills and profile.'],
  no_key: ['info', 'AI explanations are not available right now', 'These matches were calculated by simple rules from your scores, skills and profile.'],
  timeout: ['warn', 'The AI did not answer in time', 'These matches were calculated by simple rules. You can try the AI again.'],
  error: ['warn', 'The AI could not answer', 'These matches were calculated by simple rules. You can try the AI again.'],
  busy: ['warn', 'The server is busy', 'These matches were calculated on this device with simple rules and were not saved under a code. Please wait a few minutes before trying again.'],
  unreachable: ['warn', 'Could not reach the server', 'These matches were calculated on this device with simple rules and were not saved under a code.'],
};

const areaStrip = areas => `<div class="areas" role="list" aria-label="Your interest scores">${AREAS.map(a => `<div class="area" role="listitem" style="--c:${a.color};--w:${areas[a.id]}%">${pic(a.img, 36)}<span class="an">${a.name}</span><b>${areas[a.id]}</b><div class="ab"><i></i></div></div>`).join('')}</div>`;

export function results(S) {
  const r = S.result;
  const rows = r.matches.map((m, i) => {
    const c = CAREER_BY_ID[m.id];
    const top = topAreasFor(m.id, r.areas, 2);
    const summary = m.summary || rulesSummary(m.id, r.areas);
    return `<article class="mcard ${i === 0 ? 'top' : ''}" role="listitem" style="${hueVars(c.field)}">
     <span class="rank">${i + 1}</span>${tile(c, 64, 'big')}
     <div class="mbody"><div class="mhead"><button class="nm" data-go="/why/${c.id}">${esc(c.name)}</button>${i === 0 ? '<span class="topb">Top match</span>' : ''}<span class="fld">${FIELD_BY_ID[c.field].name}</span></div>
      <p class="msum">${esc(summary)}</p>
      <div class="fit">${top.map(t => `<span style="--c:${AREA[t.id].color}">${t.name} ${t.score}</span>`).join('')}</div></div>
     <div class="mscore"><div class="ring" style="--p:${m.match}" role="img" aria-label="${m.match} percent match"><b>${m.match}%</b></div><button class="btn sm ghost" data-go="/why/${c.id}">Why it fits</button></div></article>`;
  }).join('');
  const demo = window.COGNITA_DEMO && r.aiStatus === 'unreachable';
  const note = demo ? ['info', 'Demo version', 'These matches were calculated on your device with simple rules. The AI explanations and saving under a code work only on the full site.']
    : r.source === 'rules' && AI_NOTE[r.aiStatus] ? AI_NOTE[r.aiStatus] : null;
  const canRetry = !demo && note && ['timeout', 'error', 'unreachable', 'busy'].includes(r.aiStatus);
  const banner = note ? `<div class="banner ${note[0]}"><span class="bi">${ic(note[0] === 'warn' ? 'warn' : 'info', 20)}</span><div><b>${note[1]}</b>${note[2]}${canRetry ? '<div class="row"><button class="btn sm go" data-act="tryAi">Try the AI again</button></div>' : ''}</div></div>` : '';
  const flat = (r.flat ?? isFlat(r.areas)) ? `<div class="banner warn"><span class="bi">${ic('warn', 20)}</span><div><b>No clear preference in your answers</b>Your six interest scores are very close to each other, so these matches are not reliable. Give each statement the answer that really fits you and try again.<div class="row"><button class="btn sm go" data-act="adjust">Adjust my answers</button></div></div></div>` : '';
  const saveWarn = S.consent.save && !S.code && r.where !== 'device' && S.saveStatus !== 'off'
    ? `<div class="banner warn"><span class="bi">${ic('key', 20)}</span><div><b>Your result is not saved under a code</b>${S.saveStatus === 'not_configured' ? 'Saving is not set up on this site yet.' : 'Saving did not work this time.'} Your result stays on this device.</div></div>` : '';
  const codeBox = S.code ? `<div class="codebox">${pic('key', 44)}<div><code id="codeText">${esc(S.code)}</code><small>Your private result code. Keep it: it opens this result on any device.</small></div><button class="btn sm ghost" data-act="copy">${ic('copy', 16)} Copy</button></div>` : '';
  const lean = strongestAreas(r.areas, 2);
  const first = r.matches[0];
  return `<div class="wrap">${topbar('<button class="btn ghost sm" data-go="/dashboard">Dashboard</button>')}<main id="main">
  <section class="rhead"><div><div class="chips mb">${sourceChip(S)}<span class="chip">${pathLabel(r.profile)} path</span></div>
   <h1 class="title">Your career matches</h1><p class="sub">Based on 30 answers · ${fmtDate(r.createdAt)}${r.flat ? '' : ` · You lean towards <b>${lean[0].name}</b> and <b>${lean[1].name}</b>`}</p></div>
   <div class="leanpics" aria-hidden="true">${pic(AREA[lean[0].id].img, 80)}${pic(AREA[lean[1].id].img, 64)}</div></section>
  ${flat}${banner}${saveWarn}${codeBox}
  <h2 class="h2">Your interest scores</h2>${areaStrip(r.areas)}
  <h2 class="h2">Your top ${r.matches.length} careers</h2>
  <div class="mlist" role="list" aria-label="Career matches">${rows}</div>
  <p class="muted small">These are suggestions, not decisions. A match percentage shows how well your interests, skills and profile line up with a career profile. It is not a prediction of success.</p>
  <div class="actions"><button class="btn go" data-go="/why/${first.id}">Why ${esc(CAREER_BY_ID[first.id].name)}? ${ARROW}</button><button class="btn" data-act="roadmapFor" data-id="${first.id}">Build my roadmap</button><button class="btn ghost" data-go="/careers">Explore all ${N_CAREERS} careers</button><button class="btn ghost" data-act="adjust">Adjust my answers</button></div>${footer()}</main></div>`;
}

const gapRows = (id, owned, only) => skillGap(id, owned).filter(g => !only || only.includes(g.id)).map(g => `<div class="gaprow"><b>${esc(g.name)}</b><span class="pri ${g.priority === 'High' ? '' : 'm'}">${g.priority} priority</span><small>${esc(SKILLS[g.id].d)}</small></div>`).join('');

function howPanel(r) {
  const pro = modeOf(r.profile) === 'pro';
  const W = WEIGHTS[pro ? 'pro' : 'student'];
  const pc = x => Math.round(x * 100) + '%';
  return `<details class="how"><summary>How is this match calculated?</summary><div class="in"><ul>
     <li><b>${pc(W.interest)}</b> your interests. ${pc(SHAPE_SHARE)} of this part is the shape of your profile (are your stronger areas the ones this career needs most?), ${pc(1 - SHAPE_SHARE)} is how high your scores are in those areas.</li>
     <li><b>${pc(W.skills)}</b> the share of the career’s ${pro ? 'core' : 'basic'} skills that you ticked.</li>
     <li><b>${pc(W.extra)}</b> ${pro ? 'your goal: careers in your current field count when you want to grow there, careers in other fields count when you want a change.' : 'the share of the career’s school subjects that you like.'}</li>
     <li>Your top five include at most ${LIMITS.perField} careers from one field.</li>
     ${r.source === 'ai' ? '<li>The AI then chooses from the best candidates, may move a match by at most 15 points and writes the explanation. It cannot add careers that are not in the catalogue.</li>' : '<li>This result used no AI, so the number comes from these rules only.</li>'}</ul>
     <p>How much each area matters for a career is the Cognita team’s estimate, based on Holland (RIASEC) interest types. The percentage is a guide for exploring, not a prediction of success.</p></div></details>`;
}

export function why(S, id) {
  const c = CAREER_BY_ID[id], r = S.result, m = matchOf(S, id);
  if (!c || !r || !m) return null;
  const f = matchFacts(id, r);
  const ai = r.source === 'ai' && m.summary;
  const li = (img, h, p, extra = '') => `<li>${pic(img, 40)}<div><h4>${h}</h4><p>${p}</p>${extra}</div></li>`;
  const quotes = f.strong.map(s => `<div class="quote">You answered “${SCALE[s.value]}” to: ${esc(s.text)}</div>`).join('');
  const third = f.mode === 'pro'
    ? li('compass', 'Your goal', r.profile.goal === 'any' ? 'You are open to any field, so the field of this career did not change the match.' : f.sameField ? (r.profile.goal === 'stay' ? 'This career is in your current field, which fits your goal to grow there.' : 'This career is in your current field, but you want a change. That lowered this match a little.') : (r.profile.goal === 'change' ? `This career is in ${f.field}, a new field for you, which fits your goal.` : `This career is in ${f.field}, outside your current field. That lowered this match a little.`))
    : li('books', 'School subjects', f.subjects.length ? `You like ${f.subjects.join(' and ')}, which help in this career.` : 'None of the subjects you picked is on this career’s list. That does not rule it out.');
  const items = [
    li(AREA[f.top[0].id].img, 'Interests', `This career needs ${f.top.map(t => `${t.name} (your score ${t.score})`).join(' and ')} most.`, quotes),
    li('puzzle-piece', 'Skills', f.have.length ? `You already have ${f.have.map(esc).join(', ')}: ${f.have.length} of ${f.haveTotal} core skills.` : `You have not marked any of the ${f.haveTotal} core skills yet. That is a normal place to start.`),
    third,
  ].join('');
  const buildIds = m.build && m.build.length ? m.build : skillGap(id, r.profile.skills).slice(0, 3).map(g => g.id);
  const fbKey = (S.code || 'DEVICE') + ':' + id;
  const fb = S.feedback[fbKey];
  return `<div class="wrap">${topbar(EXIT)}<main id="main"><button class="link back" data-go="/results">${ic('back', 18)} Back to results</button>
  <div class="chips mb">${sourceChip(S)}</div>
  <h1 class="title">Why ${esc(c.name)} fits you</h1><p class="sub">${ai ? 'The AI compared your scores, skills and profile with the ' + esc(c.name) + ' profile.' : 'We compared your scores, skills and profile with the ' + esc(c.name) + ' profile.'} Here is what stands out.</p>
  <div class="why"><div class="stack"><div class="card"><h3>Where you already match</h3>
    ${ai ? `<div class="aisum"><span class="chip ai">${ic('spark', 14)} AI explanation</span><p>${esc(m.summary)}</p></div>` : `<div class="aisum plain"><p>${esc(m.summary || rulesSummary(id, r.areas))}</p></div>`}
    <ul class="facts-l">${items}</ul></div>
   <div class="card"><h3>Next up: skills to build</h3><p class="muted">These are the biggest gaps between you and the ${esc(c.name)} profile.</p>
    <div class="gaplist">${gapRows(id, r.profile.skills, buildIds) || '<p class="muted">You already have every core skill listed. Nice.</p>'}</div></div>
   ${howPanel(r)}</div>
   <aside class="stack"><div class="hero-card" style="${hueVars(c.field)}">${pic(c.img, 96)}<span class="chip lite">${r.matches[0].id === id ? 'Top match' : 'Match'} · ${FIELD_BY_ID[c.field].name}</span><div class="big">${m.match}%</div><h3>${esc(c.name)}</h3><p>${esc(c.summary)}</p>
     <button class="btn white" data-act="roadmapFor" data-id="${id}">Build my roadmap ${ARROW}</button><button class="btn outline" data-go="/career/${id}">View career details</button></div>
    <div class="card soft"><h3>You stay in control</h3><p class="muted">Matches are suggestions, not decisions. Tell us if this explanation helps.</p>
     <div class="fb"><button class="toggle ${fb === 5 ? 'on' : ''}" data-act="fb" data-v="5" data-id="${id}">Helpful</button><button class="toggle ${fb === 2 ? 'on' : ''}" data-act="fb" data-v="2" data-id="${id}">Not quite right</button></div>
     <button class="link" data-act="adjust">Adjust my answers</button></div></aside></div>${footer()}</main></div>`;
}

/* ---------- in-app screens ---------- */

export function dashboard(S) {
  if (!S.result) {
    return shell(S, 'dashboard', `<div class="welcome">${pic('waving-hand', 88)}<div><h1 class="greet">${S.name ? 'Welcome, ' + esc(S.name) : 'Welcome to Cognita'}</h1><p class="sub">You have no results yet. Answer 30 short statements and we will show you five careers that fit, with a reason for each.</p></div></div>
    <div class="card"><h3>Start here</h3><p class="muted">It is a guidance tool, not an exam. There are no wrong answers.</p><div class="row"><button class="btn go" data-go="${S.consent.privacy ? '/profile' : '/start'}">${S.answers.some(a => a !== null) ? 'Continue the assessment' : 'Start the assessment'} ${ARROW}</button><button class="btn ghost" data-go="/careers">Explore careers</button><button class="btn ghost" data-go="/open">Open a saved result</button></div></div>`);
  }
  const id = focusId(S), c = CAREER_BY_ID[id];
  const steps = roadmapSteps(S, id);
  const real = steps.filter(s => !s.goal);
  const doneN = real.filter(s => s.state === 'done').length;
  const pct = Math.round((doneN / real.length) * 100);
  const now = steps.find(s => s.state === 'now');
  const top3 = S.result.matches.slice(0, 3);
  const gap = skillGap(id, ownedSkills(S)).slice(0, 3);
  const hello = S.name ? `Hello, ${esc(S.name)}` : 'Your dashboard';
  return shell(S, 'dashboard', `<div class="hrow"><div><h1 class="greet">${hello}</h1><p class="sub">${now ? 'Your next stop is ' + esc(now.title) + '.' : 'You have reached every step. Choose a new goal any time.'}</p></div>${sourceChip(S)}</div>
  <div class="rcard" style="${hueVars(c.field)}"><div class="rh">${pic(c.img, 72)}<div><small>Your route · ${esc(c.name)}</small><h3>${now ? 'Next stop: ' + esc(now.title) : 'Route complete'}</h3></div><span class="stepn">${doneN} of ${real.length} steps</span></div>
   <div class="prg"><i style="width:${pct}%"></i></div>
   <div class="tiles">${steps.map(s => `<button class="stp ${s.state}" data-go="/roadmap/${id}?s=${s.id}"><span>${esc(s.title)}</span><small>${stateLabel(s)}</small></button>`).join('')}</div>
   <div class="row"><button class="btn white" data-go="/roadmap/${id}">Open roadmap ${ARROW}</button></div></div>
  <div class="dgrid">
   <div class="card"><h3>Recommended careers</h3>${top3.map(m => { const cc = CAREER_BY_ID[m.id]; return `<button class="cmr" style="${hueVars(cc.field)}" data-go="/why/${m.id}">${pic(cc.img, 36)}<span class="a"><b>${esc(cc.name)}</b><span class="b"><i style="width:${m.match}%"></i></span></span><em>${m.match}%</em></button>`; }).join('')}<button class="link" data-go="/results">All matches</button></div>
   <div class="card"><h3>Skills to build next</h3>${gap.length ? gap.map((g, i) => `<div class="gap1"><i>${i + 1}</i>${esc(g.name)}</div>`).join('') : '<p class="muted">You have every core skill for this career.</p>'}<div class="under"><button class="link" data-go="/career/${id}">See the skill gap</button></div></div>
   <div class="card"><h3>Your result</h3>${S.code ? `<p class="muted">Private code</p><div class="codebox flat"><code>${esc(S.code)}</code><button class="btn sm ghost" data-act="copy">${ic('copy', 16)} Copy</button></div>` : '<p class="muted">Not saved under a code. It stays on this device.</p>'}
    <div class="row"><button class="btn sm ghost" data-act="adjust">Retake or adjust</button></div></div></div>`);
}

export function career(S, id) {
  const c = CAREER_BY_ID[id];
  if (!c) return null;
  const m = matchOf(S, id);
  const owned = ownedSkills(S);
  const have = c.skills.filter(s => owned.includes(s));
  const need = c.skills.filter(s => !owned.includes(s));
  const fld = FIELD_BY_ID[c.field];
  const more = careersIn(c.field).filter(x => x.id !== id);
  const backTo = m ? ['/results', 'Back to results'] : ['/careers?f=' + c.field, 'More in ' + fld.name];
  return shell(S, 'career', `<button class="link back" data-go="${backTo[0]}">${ic('back', 18)} ${backTo[1]}</button>
  <section class="chead" style="${hueVars(c.field)}">${pic(c.img, 120, 'cpic')}<div><div class="chips mb"><button class="chip fieldchip" data-go="/careers?f=${c.field}">${pic(fld.img, 18)}${fld.name}</button>${m ? `<span class="chip">${m.match}% match</span>` : (S.result ? '<span class="chip dev">Not in your top five</span>' : '')}</div>
   <h1 class="title">${esc(c.name)}</h1><p class="sub">${esc(c.summary)}</p>
   <div class="row"><button class="btn go" data-act="roadmapFor" data-id="${id}">Build my roadmap ${ARROW}</button>${m ? `<button class="btn ghost" data-go="/why/${id}">Why it fits</button>` : ''}</div></div></section>
  <div class="dgrid two-one">
   <div class="card"><h3>What the work looks like</h3><ul class="tl">${c.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
   <div class="card soft"><h3>Market data · Kazakhstan</h3><span class="chip soon">Coming soon</span><p class="muted">Salaries, demand and requirements will appear here. We will show a number only when we have its source and the date it was checked.</p></div></div>
  <div class="card mt"><h3>Skill gap: you vs this career</h3><p class="muted">${S.result ? 'Green skills you already have. Orange skills are your next stops.' : 'Take the assessment to see which of these you already have.'}</p>
   <div class="skl">${have.map(s => `<span class="have">${esc(SKILLS[s].name)}</span>`).join('')}${need.map(s => `<span class="need">${esc(SKILLS[s].name)}</span>`).join('')}</div>
   ${S.result ? `<div class="gaplist">${gapRows(id, owned) || '<p class="muted">You already have every core skill listed. Nice.</p>'}</div>` : ''}</div>
  <div class="dgrid half"><div class="card">${pic('graduation-cap', 48)}<h3>Typical education</h3><p class="muted">${esc(c.education)}</p>${c.subjects.length ? `<div class="chips">${c.subjects.map(s => `<span class="chip dev">${esc(s)}</span>`).join('')}</div>` : ''}</div>
   <div class="card">${pic('glowing-star', 48)}<h3>A good first project</h3><p class="muted">${esc(c.first)}</p></div></div>
  ${more.length ? `<h2 class="h2">More in ${fld.name}</h2><div class="cgrid small">${more.map(x => `<button class="ccard" style="${hueVars(x.field)}" data-go="/career/${x.id}">${tile(x, 44)}<span class="cc"><b>${esc(x.name)}</b><span class="cs">${esc(x.summary)}</span></span></button>`).join('')}</div>` : ''}`);
}

/* ---------- roadmap ---------- */

export function roadmapSteps(S, id) {
  const c = CAREER_BY_ID[id];
  const owned = new Set(ownedSkills(S));
  const manual = new Set((S.roadmap[id] || {}).done || []);
  const list = c.skills.map(sid => ({ id: sid, title: SKILLS[sid].name, d: SKILLS[sid].d, pts: SKILLS[sid].pts, done: owned.has(sid) || manual.has(sid), had: owned.has(sid) }));
  list.push({ id: 'portfolio', title: 'First real project', d: c.first, pts: ['Pick a question or an idea', 'Do the work and write down what you learned', 'Publish it where other people can see it'], done: manual.has('portfolio'), had: false });
  const ordered = [...list.filter(s => s.done), ...list.filter(s => !s.done)];
  const nowIdx = ordered.findIndex(s => !s.done);
  ordered.forEach((s, i) => { s.state = s.done ? 'done' : i === nowIdx ? 'now' : 'todo'; });
  ordered.push({ id: 'goal', title: c.name, goal: true, state: 'goal', d: 'The destination. Choose another career at any time.', pts: ['Your roadmap ends here', 'Retake the assessment to rebuild it'] });
  return ordered;
}
const stateLabel = s => s.goal ? 'Destination' : s.state === 'done' ? (s.had ? 'You have it' : 'Done') : s.state === 'now' ? 'You are here' : 'Next';

export function roadmap(S, id, sel) {
  const c = CAREER_BY_ID[id];
  if (!c) return null;
  const steps = roadmapSteps(S, id);
  const cur = steps.find(s => s.id === sel) || steps.find(s => s.state === 'now') || steps[steps.length - 1];
  const real = steps.filter(s => !s.goal);
  const doneN = real.filter(s => s.state === 'done').length;
  const choices = S.result ? S.result.matches.map(m => `<button class="toggle ${m.id === id ? 'on' : ''}" data-act="roadmapFor" data-id="${m.id}">${esc(CAREER_BY_ID[m.id].name)}</button>`).join('') : '';
  const canMark = !cur.goal && !cur.had;
  return shell(S, 'roadmap', `<section class="chead slim" style="${hueVars(c.field)}">${pic(c.img, 88, 'cpic')}<div><div class="chips mb"><span class="chip">${doneN} of ${real.length} steps</span>${S.result ? '' : '<span class="chip dev">Take the assessment to personalise this</span>'}</div>
  <h1 class="greet">My roadmap</h1><p class="sub">Your path to ${esc(c.name)}. Tap a step to see what is inside.</p></div></section>
  ${choices ? `<div class="chips mb" role="group" aria-label="Choose a career">${choices}</div>` : ''}
  <div class="card"><div class="prg dark"><i style="width:${Math.round((doneN / real.length) * 100)}%"></i></div><div class="rtiles" role="group" aria-label="Roadmap steps">${steps.map((s, i) => `<button class="rt ${s.state} ${s.id === cur.id ? 'sel' : ''}" data-act="step" data-id="${s.id}" aria-pressed="${s.id === cur.id}"><span class="num">${s.state === 'done' ? CK : s.goal ? '★' : i + 1}</span><b>${esc(s.title)}</b><span class="st">${stateLabel(s)}</span></button>`).join('')}</div>
   <p class="muted small">Your roadmap is rebuilt every time you retake the assessment.</p></div>
  <div class="rmdet"><div class="card"><span class="chip">${stateLabel(cur)}</span><h3 class="rmt">${esc(cur.title)}</h3><p class="muted">${esc(cur.d)}</p>
   ${canMark ? `<button class="btn ${cur.state === 'done' ? 'ghost' : 'go'}" data-act="mark" data-id="${cur.id}">${cur.state === 'done' ? 'Undo: mark as not done' : 'Mark as done ✓'}</button>` : ''}</div>
   <div class="card soft"><h3>What is inside</h3><ul class="tl">${cur.pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>`);
}

/* ---------- open by code, privacy ---------- */

export function open(S, msg, busy) {
  return `<div class="wrap">${topbar('')}<main id="main"><div class="two"><div class="card form">${pic('key', 72)}<h1 class="title">Open a saved result</h1><p class="sub">Type the private code you got after the assessment. It looks like COG-XXXX-XXXX-XXXX.</p>
  <form class="codein" data-form="code" novalidate><label class="sr" for="f-code">Result code</label><input id="f-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="COG-XXXX-XXXX-XXXX" maxlength="19" ${msg ? 'aria-invalid="true"' : ''}><button class="btn go" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Opening…' : 'Open result'}</button></form>
  ${msg ? `<p class="err" role="alert">${esc(msg)}</p>` : ''}</div>
  <aside class="stack"><div class="card soft">${pic('thought-balloon', 56)}<h3>No code?</h3><p class="muted">Results are saved under a code only if you chose to save them. You can always take the assessment again.</p><button class="btn ghost" data-go="/start">Start the assessment</button></div></aside></div>${footer()}</main></div>`;
}

export function privacy() {
  const contact = SITE.contactEmail
    ? `<a href="mailto:${esc(SITE.contactEmail)}">${esc(SITE.contactEmail)}</a>`
    : 'the Cognita team (the contact address will be published here before the public launch)';
  return `<div class="wrap">${topbar('<button class="btn ghost sm" data-act="back">' + ic('back', 16) + ' Back</button>')}<main id="main"><div class="prose">
  ${pic('locked', 80)}<h1 class="title">Privacy Notice</h1><p class="sub">Short and plain. It describes what this website really does.</p>
  <h2>What Cognita is</h2><p>Cognita is a career guidance website made by students of Astana IT University. It gives suggestions based on your answers. It is not a psychological test and not professional career counselling.</p>
  <h2>What we do not ask for</h2><p>We do not ask for your name, email, phone number, birth date or a password. There are no accounts.</p>
  <h2>What happens to your data</h2>
  <div class="tablewrap"><table><thead><tr><th>Data</th><th>Where it goes</th><th>When</th></tr></thead><tbody>
   <tr><td>Your first name (optional)</td><td>Only your own browser</td><td>Always. Never sent.</td></tr>
   <tr><td>Your progress, answers and result</td><td>Your own browser (local storage)</td><td>Until you clear it</td></tr>
   <tr><td>Your 30 answers and profile (year and subjects, or field, experience, education and goal) and skills</td><td>Our server, to calculate your matches. The server keeps nothing unless you choose to save the result.</td><td>Each time you get matches</td></tr>
   <tr><td>Six interest scores, profile, skills and the optional note</td><td>OpenAI, to write the explanations</td><td>Only if “Use AI” is on. The note has emails and phone numbers removed first.</td></tr>
   <tr><td>Your 30 answers, scores, profile, skills and matches (never the note or your name)</td><td>A private Notion database kept by the Cognita team, under a random result code</td><td>Only if “Save my result” is on</td></tr>
   <tr><td>Feedback rating and comment</td><td>The same Notion workspace</td><td>Only when you press a feedback button. Do not write personal data in comments.</td></tr></tbody></table></div>
  <h2>OpenAI</h2><p>When the AI is on, OpenAI processes the data listed above under <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">its own privacy policy</a>. If you switch the AI off, nothing is sent to OpenAI and matches are calculated by simple rules on our server (or on your device if the server cannot be reached).</p>
  <h2>Your result code</h2><p>The code is the only key to a saved result. Anyone who has it can open that result, so share it only with people you trust.</p>
  <h2>Cookies</h2><p>We set no cookies. The site uses your browser’s local storage to remember your progress.</p>
  <h2>How long we keep it</h2><p>Saved results are kept until the team deletes them. To ask for a saved result or a comment to be deleted, contact ${contact} and include your result code.</p>
  <h2>Pictures</h2><p>The 3D pictures are Microsoft Fluent Emoji, used under the MIT licence. The Cognita logo belongs to the Cognita team.</p>
  <h2>Delete the data on this device</h2><p><button class="btn sm ghost" data-act="wipe">Clear everything stored in this browser</button></p>
  </div>${footer()}</main></div>`;
}

export function notFound() {
  return `<div class="wrap">${topbar('')}<main id="main"><div class="notice">${pic('thought-balloon', 96)}<h1 class="title">Page not found</h1><p class="sub">That page does not exist.</p><div class="row center"><button class="btn go" data-go="/">Go to the home page</button><button class="btn ghost" data-go="/careers">Explore careers</button></div></div></main></div>`;
}
