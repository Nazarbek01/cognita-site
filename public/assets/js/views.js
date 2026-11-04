// Screens. Each view takes the saved state S (and a parameter) and returns an HTML string.
// Anything that came from outside the code (name, AI sentences, codes) goes through esc().

import { AREAS, SCALE, GRADES, SUBJECTS } from '../../shared/config.mjs';
import { QUESTIONS } from '../../shared/questions.mjs';
import { CAREERS, CAREER_BY_ID } from '../../shared/careers.mjs';
import { SKILLS, STARTER_IDS } from '../../shared/skills.mjs';
import { scoreAreas, skillGap, topAreasFor, matchFacts, rulesSummary } from '../../shared/engine.mjs';
import { SITE } from './site.config.js';
import { ic, CK, LOCK, LOGO } from './icons.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const up = s => String(s).toUpperCase();
const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

/* ---------- shared pieces ---------- */

const logo = () => `<button class="logo" data-go="/" aria-label="Cognita, home"><span class="lm">${LOGO}</span>Cognita</button>`;
const demoNote = () => (window.COGNITA_DEMO
  ? `<div class="banner warn" role="note"><span class="bi">${ic('info', 20)}</span><div><b>Demo version</b>This copy runs only in your browser. The AI and saving a result under a code need a server, so they are switched off here and matches are calculated on your device.</div></div>`
  : '');
const topbar = extra => `<div class="top">${logo()}${extra || ''}</div>`;
const EXIT = '<button class="link" data-act="exit">Save &amp; exit</button>';
const footer = () => `<footer class="footer"><span>Cognita is a guidance tool, not a psychological test or professional career counselling.</span><button class="link" data-go="/privacy">Privacy Notice</button></footer>`;

function stepper(active) {
  const L = ['Start', 'Your path', 'Profile', 'Assessment'];
  return `<div class="stepper"><ol class="route">${L.map((l, i) => {
    const n = i + 1; const cls = n < active ? 'done' : n === active ? 'now' : '';
    return `<li class="${cls}"><i>${n < active ? CK : ''}</i><span class="n">STEP ${n}</span>${l}</li>`;
  }).join('')}</ol></div>`;
}

export const focusId = S => (S.focus && CAREER_BY_ID[S.focus]) ? S.focus : (S.result ? S.result.matches[0].id : CAREERS[0].id);
const ownedSkills = S => (S.result ? S.result.profile.skills : S.profile.skills);
const matchOf = (S, id) => S.result && S.result.matches.find(m => m.id === id);
const letter = (c, size = '') => `<span class="lc" style="--c:${c.color};--on:${c.on}">${c.letter}</span>`;

const sourceChip = S => {
  const r = S.result; if (!r) return '';
  if (r.where === 'device') return '<span class="chip dev">Calculated on this device</span>';
  return r.source === 'ai' ? '<span class="chip ai">AI-generated</span>' : '<span class="chip dev">Calculated by rules</span>';
};

function shell(S, active, inner) {
  const f = focusId(S);
  const nav = [
    ['/dashboard', 'Dashboard', 'dashboard', 'var(--color-primary)'],
    ['/results', 'My matches', 'results', 'var(--color-accent)'],
    ['/career/' + f, 'Career details', 'career', 'var(--color-info)'],
    ['/roadmap/' + f, 'My roadmap', 'roadmap', 'var(--color-success)'],
  ];
  const side = nav.map(([to, n, id, c]) => `<button data-go="${to}" ${id === active ? 'aria-current="page"' : ''}><i style="--c:${c}"></i>${n}</button>`).join('')
    + '<button disabled><i style="--c:var(--color-warn)"></i>Market analytics<em>Soon</em></button>'
    + '<button disabled><i style="--c:var(--color-highlight)"></i>Quests &amp; rewards<em>Soon</em></button>'
    + `<button data-go="/privacy" ${active === 'privacy' ? 'aria-current="page"' : ''}><i style="--c:var(--p-slate-400)"></i>Privacy</button>`;
  const who = S.name ? esc(S.name) : 'Student';
  const initials = esc((S.name || 'S').trim().slice(0, 2).toUpperCase());
  const tabs = [['/dashboard', 'Home', 'dashboard'], ['/results', 'Matches', 'results'], ['/career/' + f, 'Career', 'career'], ['/roadmap/' + f, 'Roadmap', 'roadmap'], ['/privacy', 'Privacy', 'privacy']]
    .map(([to, n, id]) => `<button data-go="${to}" ${id === active ? 'aria-current="page"' : ''}><i></i>${n}</button>`).join('');
  return `<div class="wrap"><div class="app"><aside class="side">${logo()}<nav aria-label="Main menu">${side}</nav><div class="me"><b>${initials}</b><span>${who}<small>${S.result ? 'Grade ' + esc(S.result.profile.grade) : 'Student'}</small></span></div></aside><main id="main">${inner}${footer()}</main></div></div>
  <nav class="tabbar" aria-label="Main menu">${tabs}</nav>`;
}

/* ---------- landing ---------- */

function feat(n, icon, title, color, tint, deep, state, rows) {
  return `<article class="card fc" style="--ac:${color}"><div class="fhead"><span class="ftag" style="background:${tint};color:${deep}">Feature 0${n}</span><div class="right"><span class="fstate ${state}">${state === 'live' ? 'Live' : 'Coming soon'}</span><span class="ic" style="--ic:${color}">${ic(icon, 24)}</span></div></div><h3>${title}</h3>
  ${rows.map(([l, t], i) => `<div class="mc ${'abc'[i]}"><small>${l}</small><span>${t}</span></div>`).join('')}</article>`;
}
const flowStep = (icon, t, d) => `<div class="fs"><span class="fi">${ic(icon, 26)}</span><div><b>${t}</b><span>${d}</span></div></div>`;

export function home(S) {
  const started = S.answers.some(a => a !== null);
  const done = !!S.result;
  const cta = done ? ['Open my dashboard →', '/dashboard'] : started ? ['Continue where you left off →', '/test'] : ['Start the assessment →', '/start'];
  const mock = `<div class="mock" role="img" aria-label="Example of the Cognita dashboard: a route to Data Analyst and three example career matches">
   <div class="mt">${logo().replace('data-go="/"', 'tabindex="-1" aria-hidden="true"')}<span class="chip sample">Example</span></div>
   <div class="road"><small>YOUR ROUTE</small><b>Data Analyst</b><div class="prg"><i style="width:34%"></i></div>
    <div class="stps"><span>Excel basics</span><span class="on">SQL</span><span>Statistics</span></div></div>
   <div class="mm"><b>Top matches</b>
    <div class="mr"><span>Data Analyst</span><div><i style="width:84%"></i></div><span>84%</span></div>
    <div class="mr"><span>UX/UI Designer</span><div><i style="width:77%"></i></div><span>77%</span></div>
    <div class="mr"><span>Software Engineer</span><div><i style="width:71%"></i></div><span>71%</span></div></div></div>`;
  return `<div class="wrap">${topbar(`<nav class="navlinks" aria-label="Site"><button class="link hide-sm" data-scroll="how">How it works</button><button class="link hide-sm" data-scroll="ai">How AI is used</button><button class="link hide-sm" data-go="/open">Open my result</button><button class="btn ghost sm" data-go="${done ? '/dashboard' : '/start'}">${done ? 'Dashboard' : 'Get started'}</button></nav>`)}
 <main id="main">
 ${demoNote()}
 <section class="hero2"><div><span class="pill-g">Next-gen career navigation</span>
  <h1>Your future shouldn’t be a guess.</h1>
  <p class="lead">Meet Cognita, your personal career navigation platform, connecting self-discovery with concrete action.</p>
  <div class="cta"><button class="btn white" data-go="${cta[1]}">${cta[0]}</button><button class="btn outline" data-scroll="ai">How the AI is used</button></div>
  <ul class="facts"><li>30 short statements</li><li>A reason for every match</li><li>No name or email needed</li></ul></div>${mock}</section>

 <section class="sect"><span class="tag" style="--tc:var(--color-accent)">The idea &amp; market problem</span>
  <h2>Cognita connects “Who am I?” with “What next?”</h2>
  <div class="g3" style="margin-top:22px">
   <article class="card" style="--ac:var(--color-highlight)"><div class="ihead"><span class="ic" style="--ic:var(--color-highlight)">${ic('warn', 24)}</span><h3>The problem</h3></div>
    <ul class="bad"><li><span><b>Unsure fit:</b> students lack clarity on which career matches their personal strengths.</span></li><li><span><b>No structure:</b> guidance is scattered, fragmented, and hard to follow effectively.</span></li><li><span><b>Skill gaps:</b> hard to identify exactly what skills are missing to enter the market.</span></li></ul></article>
   <article class="card" style="--ac:var(--color-primary)"><div class="ihead"><span class="ic" style="--ic:var(--color-primary)">${ic('bulb', 24)}</span><h3>The solution</h3></div>
    <p>Self-discovery connected directly to an executable action plan:</p>
    <div class="steps3"><div>1 · AI Self-Assessment</div><div>2 · Skill-Gap Identification</div><div>3 · Personalized Roadmap</div></div></article>
   <article class="card aud" style="--ac:var(--color-accent)"><div class="ihead"><span class="ic" style="--ic:var(--color-accent)">${ic('users', 24)}</span><h3>Audience</h3></div>
    <h4>Target audience</h4><ul><li>Students (15–22)</li><li>Career Explorers (22–30)</li><li>Career Changers (30+)</li></ul>
    <div class="okbox"><b>Made by students</b>Cognita is built by the Cognita team, students of Astana IT University. Version 1 is for students; other paths come later.</div></article></div></section>

 <section class="sect"><span class="tag" style="--tc:var(--color-primary)">Discovery &amp; skills</span>
  <h2>Understand yourself and what to learn</h2><p class="sub">Features 1–3. Live means you can use it today.</p>
  <div class="g3">${feat(1, 'assess', 'AI Career Assessment', 'var(--color-primary)', 'var(--color-primary-tint)', 'var(--color-primary-deep)', 'live', [['Input', '30 statements about your interests, plus your studies and skills'], ['Process', 'Your scores are compared with 12 career profiles, and the AI explains the result'], ['Output', 'Five careers with a match percentage and “why it fits”']])}
   ${feat(2, 'chart', 'Market Analytics', 'var(--color-accent)', 'var(--color-accent-tint)', 'var(--color-accent-deep)', 'soon', [['Data scope', 'Salaries in USD, market requirements, demand in Kazakhstan'], ['Use case', 'Compare multiple careers side by side'], ['Trust factor', 'Every number will show its source and date. No source, no number.']])}
   ${feat(3, 'sliders', 'Skill-Gap Analysis', 'var(--color-info)', 'var(--color-info-tint)', 'var(--color-info-deep)', 'live', [['Input', 'Skills you have vs the core skills of a career'], ['Process', 'Compares the two lists'], ['Output', 'Missing skills ordered by priority']])}</div></section>

 <section class="sect"><span class="tag" style="--tc:var(--color-highlight)">Roadmap &amp; motivation</span>
  <h2>Turn the plan into action</h2><p class="sub">Features 4–6.</p>
  <div class="g3">${feat(4, 'route', 'Personal Roadmap', 'var(--color-warn)', 'var(--color-warn-tint)', 'var(--color-warn-deep)', 'live', [['What it is', 'Step-by-step path to the target career'], ['Details', 'One step for each skill you are missing, then a portfolio project'], ['Updates', 'Rebuilt every time you retake the assessment']])}
   ${feat(5, 'flame', 'Quests &amp; Rewards', 'var(--color-highlight)', 'var(--color-highlight-tint)', 'var(--color-highlight-deep)', 'soon', [['Daily tasks', 'Daily quests linked to your roadmap steps'], ['Rewards', 'Streaks, badges and points'], ['Core goal', 'Build a steady learning habit']])}
   ${feat(6, 'pie', 'Weakness Analytics', 'var(--color-success)', 'var(--color-success-tint)', 'var(--color-success-deep)', 'soon', [['Input', 'Mistakes made in practice quizzes'], ['Process', 'Finds weak topics automatically'], ['Output', 'Targeted practice and progress stats']])}</div></section>

 <section class="sect" id="ai"><span class="tag" style="--tc:var(--color-accent)">How the AI is used</span>
  <h2>Helpful, limited and under your control</h2><p class="sub">What the AI does, what it never gets, and what you decide.</p>
  <div class="g3">
   <article class="card" style="--ac:var(--color-accent)"><div class="ihead"><span class="ic" style="--ic:var(--color-accent)">${ic('spark', 24)}</span><h3>What it does</h3></div>
    <p class="muted">Your 30 answers become six interest scores. The AI reads those scores with your studies and skills, compares them with 12 career profiles and writes a short reason for each of your top five. It may move a match by at most 15 points from the calculated baseline.</p></article>
   <article class="card" style="--ac:var(--color-success)"><div class="ihead"><span class="ic" style="--ic:var(--color-success)">${ic('lock', 24)}</span><h3>What it never gets</h3></div>
    <p class="muted">Your name, email and birth date are never sent. An optional note to the AI has email addresses and phone numbers removed first. Nothing you type in that note is saved on our side.</p></article>
   <article class="card" style="--ac:var(--color-primary)"><div class="ihead"><span class="ic" style="--ic:var(--color-primary)">${ic('user', 24)}</span><h3>What you control</h3></div>
    <p class="muted">You can switch the AI off and get matches calculated by simple rules. Matches are suggestions, not decisions: every one comes with a reason you can check, and you can change your answers at any time.</p></article></div></section>

 <section class="sect" id="how"><span class="tag" style="--tc:var(--color-info)">How it works</span>
  <h2>Five steps from “Who am I?” to “What next?”</h2>
  <div class="flow5" style="margin-top:22px">${flowStep('user', 'Understand yourself', '30 statements about your interests, plus your studies and skills.')}${flowStep('search', 'Explore careers', 'Five matches, each with a reason why it fits.')}${flowStep('chart', 'Compare options', 'Core skills, tasks and education for each career.')}${flowStep('route', 'Build a roadmap', 'One step for every skill you are missing.')}${flowStep('rocket', 'Take action', 'Mark steps as done and watch your route fill up.')}</div>
  <div class="goalpill">${ic('target', 26)}<span>Self-discovery and a clear, actionable career roadmap in one place.</span></div>
  <div class="cta" style="justify-content:center;margin-top:24px"><button class="btn go" data-go="${cta[1]}">${cta[0]}</button></div></section>
 ${footer()}</main></div>`;
}

/* ---------- onboarding ---------- */

const check = (k, on, title, desc, cls = '') => `<button class="check ${cls}" role="checkbox" aria-checked="${on}" data-act="consent" data-k="${k}"><span class="box">${on ? CK : ''}</span><span><b>${title}</b>${desc}</span></button>`;

export function start(S, err) {
  const c = S.consent;
  const form = `<div class="card"><h1 class="title">Let’s get started</h1><p class="sub">No account and no password. Your progress stays in this browser, and you can get a private code to open your result later.</p>
  <div class="field"><label for="f-name">First name (optional)</label><input id="f-name" data-f="name" value="${esc(S.name)}" maxlength="30" autocomplete="given-name" placeholder="Used only to greet you"><span class="hint">Stays on this device. It is never sent anywhere.</span></div>
  ${check('privacy', c.privacy, 'I have read the Privacy Notice', 'What data Cognita collects, why, and for how long.', err ? 'bad' : '')}
  <div style="margin:-2px 0 14px"><button class="link" data-go="/privacy">Open the Privacy Notice</button></div>
  ${err ? '<p class="err" role="alert">Please confirm that you have read the Privacy Notice to continue.</p>' : ''}
  ${check('ai', c.ai, 'Use AI to explain my matches', 'My six interest scores, year, subjects and skills (never my name or email) are sent to OpenAI. If this is off, matches are calculated by simple rules.')}
  ${check('save', c.save, 'Save my result under a private code', 'So I can open it later or on another device. Anyone with the code can see the result, so keep it private.')}
  <div class="row" style="margin-top:6px"><button class="btn go" data-act="startNext">Continue →</button></div></div>`;
  const tk = `<aside class="ticket"><div class="tp"><small>What happens next</small><b>Four short steps</b></div>
   <div class="tp"><div class="g"><div><small>1</small><b>Your path</b></div><div><small>2</small><b>Your studies</b></div><div><small>3</small><b>30 statements</b></div><div><small>4</small><b>Your matches</b></div></div></div>
   <div class="tp"><small>You get</small><b>5 careers, each with a reason</b></div></aside>`;
  return `<div class="wrap">${topbar(`<button class="link" data-go="/open">Open my result</button>`)}<main id="main">${demoNote()}${stepper(1)}<div class="two">${form}${tk}</div>${footer()}</main></div>`;
}

export function type() {
  const a = `<button class="opt on" data-go="/profile"><span class="oi">${ic('cap', 28)}</span><h3>I’m a student</h3><p>I want to find careers that fit me and a plan to reach one.</p></button>`;
  const b = `<button class="opt" disabled><span class="oi" style="background:var(--color-border);color:var(--color-text-muted)">${ic('user', 28)}</span><h3>I’m a professional</h3><p>I work, or I want to change careers. Coming soon.</p></button>`;
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(2)}<h1 class="title">Which describes you best?</h1><p class="sub">This sets up your plan. Version 1 follows the student path.</p>
  <div class="pick">${a}${b}</div><div class="row" style="margin-top:24px"><button class="btn go" data-go="/profile">Continue →</button><button class="btn ghost" data-go="/start">Back</button></div>${footer()}</main></div>`;
}

const toggle = (k, id, label, on) => `<button class="toggle ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-act="toggle" data-k="${k}" data-id="${esc(id)}">${esc(label)}</button>`;

export function profile(S) {
  const p = S.profile;
  const left = `<div class="card"><h1 class="title">Tell us about your studies</h1><p class="sub">Pick what fits. You can change it later.</p>
  <div class="field"><label for="f-grade">Year at school</label><select id="f-grade" data-f="grade">${GRADES.map(g => `<option value="${esc(g)}" ${p.grade === g ? 'selected' : ''}>${/^\d+$/.test(g) ? 'Grade ' + g : g}</option>`).join('')}</select></div>
  <div class="field"><label>Subjects you like</label><div class="chips">${SUBJECTS.map(s => toggle('subject', s, s, p.subjects.includes(s))).join('')}</div></div>
  <div class="field"><label>Skills you already have</label><div class="chips">${STARTER_IDS.map(id => toggle('skill', id, SKILLS[id].name, p.skills.includes(id))).join('')}</div></div>
  ${S.consent.ai ? `<div class="field"><label for="f-note">Anything else the AI should know? (optional)</label><textarea id="f-note" data-f="note" maxlength="300" placeholder="For example: what you enjoy doing in your free time">${esc(p.note)}</textarea><span class="hint">Do not write your name or contact details. Email addresses and phone numbers are removed before sending. This note is not saved on our side.</span><span class="count" id="note-count">${p.note.length}/300</span></div>` : ''}
  <div class="row" style="margin-top:8px"><button class="btn go" data-act="toTest">Continue to the assessment →</button><button class="btn ghost" data-go="/type">Back</button></div></div>`;
  const right = `<aside class="stack"><div class="card"><h3>Why we ask</h3><p class="muted">These answers are compared with career profiles together with your assessment. Your name, email and birth date are never asked for and never sent.</p></div>
  <div class="ticket"><div class="tp"><small>Your progress so far</small><b>Student · ${/^\d+$/.test(p.grade) ? 'Grade ' + esc(p.grade) : esc(p.grade)}</b></div><div class="tp"><small>Next step</small><b>Assessment · 30 statements</b></div></div></aside>`;
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(3)}<div class="two">${left}${right}</div>${footer()}</main></div>`;
}

/* ---------- assessment ---------- */

export function test(S) {
  const q = Math.min(Math.max(S.q, 0), 29);
  const cur = S.answers[q];
  const answered = S.answers.filter(a => a !== null).length;
  const all = answered === 30;
  return `<div class="wrap">${topbar(EXIT)}<main id="main">${stepper(4)}
  <div class="card q"><h1 class="sr">Assessment, statement ${q + 1} of 30</h1><div class="meta"><span>Statement ${q + 1} of 30</span><span>${all ? 'All answered' : (30 - answered) + ' to go'}</span></div>
   <div class="rail" aria-hidden="true">${Array.from({ length: 30 }, (_, k) => `<i class="${S.answers[k] !== null && k !== q ? 'd' : ''} ${k === q ? 'c' : ''}"></i>`).join('')}</div>
   <h2 id="qtext">${esc(QUESTIONS[q].text)}</h2>
   <div class="scale" role="radiogroup" aria-labelledby="qtext">${SCALE.map((l, k) => `<button class="sc ${cur === k ? 'on' : ''}" role="radio" aria-checked="${cur === k}" data-act="ans" data-v="${k}" tabindex="${(cur === k || (cur === null && k === 0)) ? 0 : -1}"><i></i><span>${l}</span></button>`).join('')}</div>
   <p class="muted" style="font-size:13px">Tip: press 1 to 5 on your keyboard.</p>
   <div class="qfoot"><button class="btn ghost" data-act="prevq" ${q === 0 ? 'disabled' : ''}>← Previous</button>${all ? '<button class="btn go" data-act="finish">See my matches →</button>' : ''}</div></div>${footer()}</main></div>`;
}

export function analysis(S) {
  const areas = scoreAreas(S.answers.map(a => a ?? 0));
  const ai = S.consent.ai;
  return `<div class="wrap an">${topbar(ai ? '<span class="chip ai">AI analysis</span>' : '<span class="chip dev">Rules only</span>')}<main id="main">${stepper(4)}
  <div class="two"><div class="card"><div class="chips" style="margin-bottom:14px"><span class="chip ${ai ? 'ai' : 'dev'}"><span class="spin"></span>${ai ? 'AI is working' : 'Working'}</span><span class="chip" id="anStep" aria-live="polite">Step 1 of 4</span></div>
   <h1>Analysing your 30 answers</h1><p class="sub">Your answers are saved on this device, so you can leave and come back.</p>
   <ol class="route v">
    <li id="a0"><i></i><div><b>Scoring your answers on 6 interest areas</b><small>Each answer adds to one area. These are your real scores.</small>
      <div class="meters">${AREAS.map(a => `<div class="meter" style="--c:${a.color}"><span>${a.name}</span><span>${areas[a.id]}</span><div><i data-w="${areas[a.id]}"></i></div></div>`).join('')}</div></div></li>
    <li id="a1"><i></i><div><b>Comparing your profile with 12 career profiles</b><small>Interests, skills and school subjects against each career.</small></div></li>
    <li id="a2"><i></i><div><b>${ai ? 'Writing “why it fits” explanations' : 'Preparing short explanations'}</b><small>A short reason for each top match.</small></div></li>
    <li id="a3"><i></i><div><b>Preparing your matches</b><small>Ranking careers for your results.</small></div></li></ol></div>
   <aside class="stack"><div class="card"><h3>${ai ? 'What is sent to the AI' : 'What is sent to our server'}</h3>
    <ul class="sent">${ai ? `<li>${CK}Your six interest scores, worked out from your 30 answers</li>` : `<li>${CK}Your 30 answers, to calculate the matches</li>`}<li>${CK}Your year, subjects and skills</li>${ai && S.profile.note ? `<li>${CK}Your optional note, with emails and phone numbers removed</li>` : ''}</ul>
    <div class="chips" style="margin-bottom:8px"><span class="chip ok">${LOCK} Never sent</span></div>
    <ul class="sent never" style="margin-bottom:0"><li>Your name</li><li>Your email</li><li>Your birth date</li></ul></div></aside></div>${footer()}</main></div>`;
}

export function delay(S) {
  const st = S.result && S.result.aiStatus;
  const slow = st === 'timeout';
  return `<div class="wrap">${topbar('')}<main id="main"><div class="notice"><div class="nhead"><span class="chip warn">Service notice</span><span class="chip">AI</span></div><div class="nbody">
   <div class="nicon">${ic('clock', 36)}</div>
   <h1>${slow ? 'The AI is taking longer than usual' : 'The AI could not answer right now'}</h1>
   <p class="sub" style="margin-bottom:22px">Your 30 answers are saved on this device. You can try the AI again, or see matches calculated by simple rules right away.</p>
   <p style="display:flex;gap:10px;align-items:center;margin-bottom:24px;font-weight:500"><span class="chip ok" style="padding:6px 7px">${CK}</span>Your answers stay saved. Nothing was lost.</p>
   <div class="row"><button class="btn go" data-act="tryAi">Try again</button><button class="btn ghost" data-go="/results">Show rule-based matches</button></div></div></div>${footer()}</main></div>`;
}

/* ---------- results ---------- */

const AI_NOTE = {
  off: ['info', 'AI is off', 'These matches were calculated by simple rules from your scores, skills and subjects.'],
  no_key: ['info', 'AI explanations are not available right now', 'These matches were calculated by simple rules from your scores, skills and subjects.'],
  timeout: ['warn', 'The AI did not answer in time', 'These matches were calculated by simple rules. You can try the AI again.'],
  error: ['warn', 'The AI could not answer', 'These matches were calculated by simple rules. You can try the AI again.'],
  busy: ['warn', 'The server is busy', 'These matches were calculated on this device with simple rules and were not saved under a code. Please wait a few minutes before trying again.'],
  unreachable: ['warn', 'Could not reach the server', 'These matches were calculated on this device with simple rules and were not saved under a code.'],
};

export function results(S) {
  const r = S.result;
  const rows = r.matches.map((m, i) => {
    const c = CAREER_BY_ID[m.id];
    const top = topAreasFor(m.id, r.areas, 2);
    return `<div class="mrow ${i === 0 ? 'top' : ''}" role="listitem" style="--c:${c.color};--on:${c.on}">${letter(c)}
    <div class="mn"><button class="nm" data-go="/why/${c.id}">${esc(c.name)}</button>${i === 0 ? '<small>TOP MATCH</small>' : ''}</div>
    <div class="mb" aria-label="${m.match} percent match"><div><i style="width:${m.match}%"></i></div><b>${m.match}%</b></div>
    <div class="fit">${top.map(t => `<span>${t.name} ${t.score}</span>`).join('')}</div></div>`;
  }).join('');
  const demo = window.COGNITA_DEMO && r.aiStatus === 'unreachable';
  const note = demo ? ['info', 'Demo version', 'These matches were calculated on your device with simple rules. The AI explanations and saving under a code work only on the full site.']
    : r.source === 'rules' && AI_NOTE[r.aiStatus] ? AI_NOTE[r.aiStatus] : null;
  const canRetry = !demo && note && ['timeout', 'error', 'unreachable', 'busy'].includes(r.aiStatus);
  const banner = note ? `<div class="banner ${note[0]}"><span class="bi">${ic(note[0] === 'warn' ? 'warn' : 'info', 20)}</span><div><b>${note[1]}</b>${note[2]}${canRetry ? '<div class="row"><button class="btn sm go" data-act="tryAi">Try the AI again</button></div>' : ''}</div></div>` : '';
  const saveWarn = S.consent.save && !S.code && r.where !== 'device' && S.saveStatus !== 'off'
    ? `<div class="banner warn"><span class="bi">${ic('key', 20)}</span><div><b>Your result is not saved under a code</b>${S.saveStatus === 'not_configured' ? 'Saving is not set up on this site yet.' : 'Saving did not work this time.'} Your result stays on this device.</div></div>` : '';
  const codeBox = S.code ? `<div class="codebox"><span class="bi" style="color:var(--color-primary)">${ic('key', 24)}</span><div><code id="codeText">${esc(S.code)}</code><small>Your private result code. Keep it: it opens this result on any device.</small></div><button class="btn sm ghost" data-act="copy">${ic('copy', 16)} Copy</button></div>` : '';
  const strip = `<div class="areas" role="list" aria-label="Your interest scores">${AREAS.map(a => `<div class="meter" role="listitem" style="--c:${a.color};--w:${r.areas[a.id]}%"><span>${a.name}</span><span>${r.areas[a.id]}</span><div><i></i></div></div>`).join('')}</div>`;
  const first = r.matches[0];
  return `<div class="wrap">${topbar('<button class="btn ghost sm" data-go="/dashboard">Dashboard</button>')}<main id="main">
  <div class="chips" style="margin-bottom:12px">${sourceChip(S)}</div>
  <h1 class="title">Your career matches</h1><p class="sub">Based on 30 answers · ${fmtDate(r.createdAt)}</p>
  ${banner}${saveWarn}${codeBox}
  <h2 style="font-size:22px;margin:0 0 10px">Your interest scores</h2>${strip}
  <h2 style="font-size:22px;margin:6px 0 10px">Top ${r.matches.length} careers</h2>
  <div class="mlist" role="list" aria-label="Career matches">${rows}</div>
  <p class="muted" style="margin:0 0 18px;max-width:660px">These are suggestions, not decisions. A match percentage shows how well your interests, skills and subjects line up with a career profile. It is not a prediction of success.</p>
  <div class="actions"><button class="btn go" data-go="/why/${first.id}">Why ${esc(CAREER_BY_ID[first.id].name)}? →</button><button class="btn" data-go="/career/${first.id}">View career details</button><button class="btn ghost" data-act="roadmapFor" data-id="${first.id}">Build my roadmap</button><button class="btn ghost" data-act="adjust">Adjust my answers</button></div>${footer()}</main></div>`;
}

const gapRows = (id, owned, only) => skillGap(id, owned).filter(g => !only || only.includes(g.id)).map(g => `<div class="gaprow"><b>${esc(g.name)}</b><span class="pri ${g.priority === 'High' ? '' : 'm'}">${g.priority} priority</span><small>${esc(SKILLS[g.id].d)}</small></div>`).join('');

export function why(S, id) {
  const c = CAREER_BY_ID[id], r = S.result, m = matchOf(S, id);
  if (!c || !r || !m) return null;
  const f = matchFacts(id, r);
  const ai = r.source === 'ai' && m.summary;
  const li = (t, h, p, extra = '') => `<li><span class="fi2">${CK}</span><div><h4>${h}</h4><p>${p}</p>${extra}</div></li>`;
  const quotes = f.strong.map(s => `<div class="quote">You answered “${SCALE[s.value]}” to: ${esc(s.text)}</div>`).join('');
  const items = [
    li('i', 'Interests', `Your scores for the areas that matter most here are ${f.top.map(t => `${t.name} (${t.score})`).join(' and ')}.`, quotes),
    li('s', 'Skills', f.have.length ? `You already have ${f.have.map(esc).join(', ')}: ${f.have.length} of ${f.haveTotal} core skills.` : `You have not marked any of the ${f.haveTotal} core skills yet. That is a normal place to start.`),
    li('u', 'School subjects', f.subjects.length ? `You like ${f.subjects.join(' and ')}, which fit this career.` : 'None of the subjects you picked is on this career’s list. That does not rule it out.'),
  ].join('');
  const buildIds = m.build && m.build.length ? m.build : skillGap(id, r.profile.skills).slice(0, 3).map(g => g.id);
  const fbKey = (S.code || 'DEVICE') + ':' + id;
  const fb = S.feedback[fbKey];
  return `<div class="wrap">${topbar(EXIT)}<main id="main"><button class="link back" data-go="/results">← Back to results</button>
  <div class="chips" style="margin-bottom:12px">${sourceChip(S)}</div>
  <h1 class="title">Why ${esc(c.name)} fits you</h1><p class="sub">${ai ? 'The AI compared your scores, skills and subjects with the ' + esc(c.name) + ' profile.' : 'We compared your scores, skills and subjects with the ' + esc(c.name) + ' profile.'} Here is what stands out.</p>
  <div class="why"><div class="stack"><div class="card"><h3>Where you already match</h3>
    ${ai ? `<div class="aisum"><span class="chip ai">${ic('spark', 14)} AI explanation</span><p>${esc(m.summary)}</p></div>` : `<div class="aisum"><p>${esc(m.summary || rulesSummary(id, r.areas))}</p></div>`}
    <ul class="facts-l">${items}</ul></div>
   <div class="card"><h3>Next up: skills to build</h3><p class="muted">These are the biggest gaps between you and the ${esc(c.name)} profile.</p>
    <div class="gaplist">${gapRows(id, r.profile.skills, buildIds) || '<p class="muted">You already have every core skill listed. Nice.</p>'}</div></div>
   <details class="how"><summary>How is this match calculated?</summary><div class="in"><ul>
     <li><b>70%</b> your interest scores, weighted by how much each area matters for the career.</li>
     <li><b>20%</b> the share of the career’s basic skills that you ticked.</li>
     <li><b>10%</b> the share of the career’s school subjects that you like.</li>
     ${r.source === 'ai' ? '<li>The AI may then move the match by at most 15 points and writes the explanation. It cannot add careers that are not in the catalogue.</li>' : '<li>This result used no AI, so the number comes from these rules only.</li>'}</ul>
     <p>The percentage is a guide for exploring, not a prediction of success.</p></div></details></div>
   <aside class="stack"><div class="dark"><span class="chip">${r.matches[0].id === id ? 'Top match' : 'Match'}</span><div class="big">${m.match}%</div><h3>${esc(c.name)}</h3><p style="color:var(--color-on-brand-soft);font-size:14px;margin-bottom:12px">${esc(c.summary)}</p>
     <button class="btn white" data-act="roadmapFor" data-id="${id}">Build my roadmap →</button><button class="btn outline" data-go="/career/${id}">View career details</button></div>
    <div class="card"><h3>You stay in control</h3><p class="muted">Matches are suggestions, not decisions. Tell us if this explanation helps.</p>
     <div class="fb"><button class="toggle ${fb === 5 ? 'on' : ''}" data-act="fb" data-v="5" data-id="${id}">Helpful</button><button class="toggle ${fb === 2 ? 'on' : ''}" data-act="fb" data-v="2" data-id="${id}">Not quite right</button></div>
     <button class="link" data-act="adjust">Adjust my answers →</button></div></aside></div>${footer()}</main></div>`;
}

/* ---------- in-app screens ---------- */

export function dashboard(S) {
  if (!S.result) {
    return shell(S, 'dashboard', `<h1 class="greet">${S.name ? 'Welcome, ' + esc(S.name) : 'Welcome to Cognita'}</h1><p class="sub">You have no results yet. Answer 30 short statements and we will show you five careers that fit, with a reason for each.</p>
    <div class="card"><h3>Start here</h3><p class="muted" style="margin-bottom:16px">It is a guidance tool, not an exam. There are no wrong answers.</p><div class="row"><button class="btn go" data-go="${S.consent.privacy ? '/profile' : '/start'}">${S.answers.some(a => a !== null) ? 'Continue the assessment →' : 'Start the assessment →'}</button><button class="btn ghost" data-go="/open">Open a saved result</button></div></div>`);
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
  return shell(S, 'dashboard', `<div class="hrow"><div><h1 class="greet">${hello}</h1><p class="sub" style="margin-bottom:0">${now ? 'Your next stop is ' + esc(now.title) + '.' : 'You have reached every step. Choose a new goal any time.'}</p></div>${sourceChip(S)}</div>
  <div class="rcard"><div class="rh"><div><small>Your route · ${esc(c.name)}</small><h3>${now ? 'Next stop: ' + esc(now.title) : 'Route complete'}</h3></div><span class="stepn">${doneN} of ${real.length} steps</span></div>
   <div class="prg"><i style="width:${pct}%"></i></div>
   <div class="tiles">${steps.map(s => `<button class="tile ${s.state === 'now' ? 'now' : ''}" data-go="/roadmap/${id}?s=${s.id}"><span>${esc(s.title)}</span><small>${stateLabel(s)}</small></button>`).join('')}</div>
   <div class="row" style="margin-top:18px"><button class="btn white" data-go="/roadmap/${id}">Open roadmap →</button></div></div>
  <div class="dgrid">
   <div class="card"><h3>Recommended careers</h3>${top3.map(m => { const cc = CAREER_BY_ID[m.id]; return `<button class="cmr" style="--c:${cc.color}" data-go="/why/${m.id}"><span class="a"><b>${esc(cc.name)}</b><span>${m.match}% match</span></span><span class="b"><i style="width:${m.match}%"></i></span></button>`; }).join('')}<button class="link" data-go="/results">All matches →</button></div>
   <div class="card"><h3>Skills to build next</h3>${gap.length ? gap.map((g, i) => `<div class="gap1"><i>${i + 1}</i>${esc(g.name)}</div>`).join('') : '<p class="muted">You have every core skill for this career.</p>'}<div style="margin-top:12px"><button class="link" data-go="/career/${id}">See the skill gap →</button></div></div>
   <div class="card"><h3>Your result</h3>${S.code ? `<p class="muted" style="margin-bottom:10px">Private code</p><div class="codebox" style="box-shadow:none;padding:0;margin:0"><code>${esc(S.code)}</code><button class="btn sm ghost" data-act="copy">${ic('copy', 16)} Copy</button></div>` : '<p class="muted">Not saved under a code. It stays on this device.</p>'}
    <div class="row" style="margin-top:14px"><button class="btn sm ghost" data-act="adjust">Retake or adjust</button></div></div></div>`);
}

export function career(S, id) {
  const c = CAREER_BY_ID[id];
  if (!c) return null;
  const m = matchOf(S, id);
  const owned = ownedSkills(S);
  const have = c.skills.filter(s => owned.includes(s));
  const need = c.skills.filter(s => !owned.includes(s));
  return shell(S, 'career', `<button class="link back" data-go="${S.result ? '/results' : '/dashboard'}">← ${S.result ? 'Back to results' : 'Dashboard'}</button>
  <div class="dhead"><div><div class="row" style="margin-bottom:10px">${letter(c)}${m ? `<span class="chip">${m.match}% match</span>` : '<span class="chip dev">Not in your top matches</span>'}</div>
   <h1 class="title">${esc(c.name)}</h1><p class="sub">${esc(c.summary)}</p>
   <div class="row"><button class="btn go" data-act="roadmapFor" data-id="${id}">Build my roadmap →</button>${m ? `<button class="btn ghost" data-go="/why/${id}">Why it fits</button>` : ''}</div></div>
   <div class="card"><h3>Typical tasks</h3><ul class="tl">${c.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></div>
  <div class="card" style="margin-top:20px"><div class="sechead" style="margin:0 0 12px"><h3 style="margin:0">Market data · Kazakhstan</h3><span class="chip soon">Coming soon</span></div>
   <p class="muted">Salaries (in USD), demand and requirements will appear here. We will show a number only when we have its source and the date it was checked. Until then we show no numbers.</p></div>
  <div class="card" style="margin-top:20px"><h3>Skill gap: you vs this career</h3><p class="muted">${S.result ? 'Green skills you already have. Orange skills are your next stops.' : 'Take the assessment to see which of these you already have.'}</p>
   <div class="skl">${have.map(s => `<span class="have">${esc(SKILLS[s].name)}</span>`).join('')}${need.map(s => `<span class="need">${esc(SKILLS[s].name)}</span>`).join('')}</div>
   ${S.result ? `<div class="gaplist">${gapRows(id, owned) || '<p class="muted">You already have every core skill listed. Nice.</p>'}</div>` : ''}</div>
  <div class="dgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="card"><h3>Typical education</h3><p class="muted">${esc(c.education)}</p></div><div class="card"><h3>A good first portfolio project</h3><p class="muted">${esc(c.portfolio)}</p></div></div>`);
}

/* ---------- roadmap ---------- */

export function roadmapSteps(S, id) {
  const c = CAREER_BY_ID[id];
  const owned = new Set(ownedSkills(S));
  const manual = new Set((S.roadmap[id] || {}).done || []);
  const list = c.skills.map(sid => ({ id: sid, title: SKILLS[sid].name, d: SKILLS[sid].d, pts: SKILLS[sid].pts, done: owned.has(sid) || manual.has(sid), had: owned.has(sid) }));
  list.push({ id: 'portfolio', title: 'Portfolio project', d: c.portfolio, pts: ['Pick a question or an idea', 'Do the work and write down what you learned', 'Publish it where other people can see it'], done: manual.has('portfolio'), had: false });
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
  return shell(S, 'roadmap', `<div class="chips" style="margin-bottom:12px"><span class="chip">${doneN} of ${real.length} steps</span>${S.result ? '' : '<span class="chip dev">Take the assessment to personalise this</span>'}</div>
  <h1 class="greet">My roadmap</h1><p class="sub">Your path to ${esc(c.name)}. Tap a step to see what is inside.</p>
  ${choices ? `<div class="chips" style="margin-bottom:14px" role="group" aria-label="Choose a career">${choices}</div>` : ''}
  <div class="card"><div class="rtiles" role="group" aria-label="Roadmap steps">${steps.map((s, i) => `<button class="rt ${s.state === 'done' ? 'done' : s.state === 'now' ? 'now' : ''} ${s.goal ? 'goal' : ''} ${s.id === cur.id ? 'sel' : ''}" data-act="step" data-id="${s.id}" aria-pressed="${s.id === cur.id}"><span class="num">${s.state === 'done' ? CK : i + 1}</span><b>${esc(s.title)}</b><span class="st">${stateLabel(s)}</span></button>`).join('')}</div>
   <p class="muted" style="font-size:14px;margin-top:16px">Your roadmap is rebuilt every time you retake the assessment.</p></div>
  <div class="rmdet"><div class="card"><span class="chip">${up(stateLabel(cur))}</span><h3 style="margin-top:12px;font-size:28px">${esc(cur.title)}</h3><p class="muted" style="margin:6px 0 16px">${esc(cur.d)}</p>
   ${canMark ? `<button class="btn ${cur.state === 'done' ? 'ghost' : 'go'}" data-act="mark" data-id="${cur.id}">${cur.state === 'done' ? 'Undo: mark as not done' : 'Mark as done ✓'}</button>` : ''}</div>
   <div class="card"><h3>What is inside</h3><ul class="tl">${cur.pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>`);
}

/* ---------- open by code, privacy ---------- */

export function open(S, msg, busy) {
  return `<div class="wrap">${topbar('')}<main id="main"><div class="two"><div class="card"><h1 class="title">Open a saved result</h1><p class="sub">Type the private code you got after the assessment. It looks like COG-XXXX-XXXX-XXXX.</p>
  <form class="codein" data-form="code" novalidate><label class="sr" for="f-code">Result code</label><input id="f-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="COG-XXXX-XXXX-XXXX" maxlength="19" ${msg ? 'aria-invalid="true"' : ''}><button class="btn go" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Opening…' : 'Open result'}</button></form>
  ${msg ? `<p class="err" role="alert" style="margin-top:12px">${esc(msg)}</p>` : ''}</div>
  <aside class="stack"><div class="card"><h3>No code?</h3><p class="muted" style="margin-bottom:14px">Results are saved under a code only if you chose to save them. You can always take the assessment again.</p><button class="btn ghost" data-go="/start">Start the assessment</button></div></aside></div>${footer()}</main></div>`;
}

export function privacy() {
  const contact = SITE.contactEmail
    ? `<a href="mailto:${esc(SITE.contactEmail)}">${esc(SITE.contactEmail)}</a>`
    : 'the Cognita team (the contact address will be published here before the public launch)';
  return `<div class="wrap">${topbar('<button class="btn ghost sm" data-act="back">← Back</button>')}<main id="main"><div class="prose">
  <h1 class="title">Privacy Notice</h1><p class="sub">Short and plain. It describes what this website really does.</p>
  <h2>What Cognita is</h2><p>Cognita is a career guidance website made by students of Astana IT University. It gives suggestions based on your answers. It is not a psychological test and not professional career counselling.</p>
  <h2>What we do not ask for</h2><p>We do not ask for your name, email, phone number, birth date or a password. There are no accounts.</p>
  <h2>What happens to your data</h2>
  <table><thead><tr><th>Data</th><th>Where it goes</th><th>When</th></tr></thead><tbody>
   <tr><td>Your first name (optional)</td><td>Only your own browser</td><td>Always. Never sent.</td></tr>
   <tr><td>Your progress, answers and result</td><td>Your own browser (local storage)</td><td>Until you clear it</td></tr>
   <tr><td>Your 30 answers, year, subjects and skills</td><td>Our server, to calculate your matches. The server keeps nothing unless you choose to save the result.</td><td>Each time you get matches</td></tr>
   <tr><td>Six interest scores, year, subjects, skills and the optional note</td><td>OpenAI, to write the explanations</td><td>Only if “Use AI” is on. The note has emails and phone numbers removed first.</td></tr>
   <tr><td>Your 30 answers, scores, year, subjects, skills and matches (never the note or your name)</td><td>A private Notion database kept by the Cognita team, under a random result code</td><td>Only if “Save my result” is on</td></tr>
   <tr><td>Feedback rating and comment</td><td>The same Notion workspace</td><td>Only when you press a feedback button. Do not write personal data in comments.</td></tr></tbody></table>
  <h2>OpenAI</h2><p>When the AI is on, OpenAI processes the data listed above under <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">its own privacy policy</a>. If you switch the AI off, nothing is sent to OpenAI and matches are calculated by simple rules on our server (or on your device if the server cannot be reached).</p>
  <h2>Your result code</h2><p>The code is the only key to a saved result. Anyone who has it can open that result, so share it only with people you trust.</p>
  <h2>Cookies</h2><p>We set no cookies. The site uses your browser’s local storage to remember your progress.</p>
  <h2>How long we keep it</h2><p>Saved results are kept until the team deletes them. To ask for a saved result or a comment to be deleted, contact ${contact} and include your result code.</p>
  <h2>Delete the data on this device</h2><p><button class="btn sm ghost" data-act="wipe">Clear everything stored in this browser</button></p>
  </div>${footer()}</main></div>`;
}

export function notFound() {
  return `<div class="wrap">${topbar('')}<main id="main"><h1 class="title">Page not found</h1><p class="sub">That page does not exist.</p><button class="btn go" data-go="/">Go to the home page</button></main></div>`;
}
