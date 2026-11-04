// The matching engine. Pure functions, no network, no browser APIs.
// It runs on the server (to prepare and check the AI request) and in the browser
// (as the "on this device" fallback when the server cannot be reached).

import {
  AREAS, LIMITS, AI_MAX_SHIFT, CATALOGUE_VERSION, GRADES, SUBJECTS, MODES, EXPERIENCE, EDUCATION, GOALS,
  WEIGHTS, SHAPE_SHARE, FLAT_RANGE,
} from './config.mjs';
import { QUESTIONS } from './questions.mjs';
import { CAREERS, CAREER_BY_ID, FIELD_BY_ID, FIELD_IDS } from './careers.mjs';
import { SKILLS, SKILL_IDS, STARTER_IDS } from './skills.mjs';

const AREA_IDS = AREAS.map(a => a.id);
const AREA_NAME = Object.fromEntries(AREAS.map(a => [a.id, a.name]));
const GOAL_IDS = GOALS.map(g => g.id);

/* ---------- input checking ---------- */

export function scrubNote(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[removed]')      // e-mail addresses
    .replace(/\+?\d[\d\s().-]{5,}\d/g, '[removed]')         // phone-like numbers
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.noteMax);
}

const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const uniqueIn = (arr, allowed, max) =>
  Array.isArray(arr) && arr.length <= max && arr.every(x => allowed.includes(x)) && new Set(arr).size === arr.length;

/** Older saved results have no mode: they came from the student path. */
export const modeOf = profile => (profile && profile.mode === 'pro' ? 'pro' : 'student');

/** Check the profile part of a request. Returns { ok, value } or { ok:false, error }. */
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') return { ok: false, error: 'profile is missing.' };
  const mode = profile.mode === undefined ? 'student' : profile.mode;
  if (!MODES.includes(mode)) return { ok: false, error: 'mode is not valid.' };
  if (mode === 'student') {
    if (!GRADES.includes(profile.grade)) return { ok: false, error: 'grade is not valid.' };
    if (!uniqueIn(profile.subjects, SUBJECTS, SUBJECTS.length)) return { ok: false, error: 'subjects are not valid.' };
    if (!uniqueIn(profile.skills, STARTER_IDS, STARTER_IDS.length)) return { ok: false, error: 'skills are not valid.' };
    return { ok: true, value: { mode, grade: profile.grade, subjects: profile.subjects.slice(), skills: profile.skills.slice() } };
  }
  if (!(FIELD_IDS.includes(profile.field) || profile.field === 'other')) return { ok: false, error: 'field is not valid.' };
  if (!EXPERIENCE.includes(profile.exp)) return { ok: false, error: 'experience is not valid.' };
  if (!EDUCATION.includes(profile.edu)) return { ok: false, error: 'education is not valid.' };
  if (!GOAL_IDS.includes(profile.goal)) return { ok: false, error: 'goal is not valid.' };
  if (!uniqueIn(profile.skills, SKILL_IDS, SKILL_IDS.length)) return { ok: false, error: 'skills are not valid.' };
  return { ok: true, value: { mode, field: profile.field, exp: profile.exp, edu: profile.edu, goal: profile.goal, skills: profile.skills.slice() } };
}

/** Check what the browser sent. Returns { ok, value } or { ok:false, error }. */
export function validateInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object.' };
  const { answers, note } = body;
  if (!Array.isArray(answers) || answers.length !== LIMITS.questions || !answers.every(a => isInt(a, 0, 4)))
    return { ok: false, error: 'answers must be 30 whole numbers from 0 to 4.' };
  const p = validateProfile(body.profile);
  if (!p.ok) return p;
  return {
    ok: true,
    value: { answers: answers.slice(), profile: p.value, note: scrubNote(note), useAi: body.useAi !== false, save: body.save === true },
  };
}

/* ---------- scoring ---------- */

/** 30 answers (0..4) -> score 0..100 for each of the six areas. */
export function scoreAreas(answers) {
  const sum = Object.fromEntries(AREA_IDS.map(id => [id, 0]));
  QUESTIONS.forEach((q, i) => { sum[q.area] += answers[i]; });
  return Object.fromEntries(AREA_IDS.map(id => [id, Math.round((sum[id] / 20) * 100)]));
}

/** True when the six scores are so close that they show no clear preference (for example, the same answer everywhere). */
export function isFlat(areas) {
  const v = AREA_IDS.map(id => areas[id]);
  return Math.max(...v) - Math.min(...v) < FLAT_RANGE;
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/**
 * How well the six interest scores fit a career, 0..1.
 * shape: do your stronger areas match the areas this career needs most? (correlation, -1..1 mapped to 0..1)
 * level: how high you score in the areas the career needs (weighted average).
 */
export function interestFit(areas, w) {
  const u = AREA_IDS.map(id => areas[id]);
  const shape = (pearson(u, w) + 1) / 2;
  const level = u.reduce((s, x, i) => s + w[i] * x, 0) / (100 * w.reduce((a, b) => a + b, 0));
  return { fit: SHAPE_SHARE * shape + (1 - SHAPE_SHARE) * level, shape, level };
}

const starterSkillsOf = career => career.skills.filter(id => SKILLS[id].starter);

/** The third part of the match: school subjects (students) or the goal you chose (professionals). */
function extraFit(career, profile) {
  if (modeOf(profile) === 'student') {
    return career.subjects.length ? career.subjects.filter(s => (profile.subjects || []).includes(s)).length / career.subjects.length : 0;
  }
  if (profile.goal === 'any' || profile.field === 'other') return 0.5;
  const same = career.field === profile.field;
  return profile.goal === 'stay' ? (same ? 1 : 0) : (same ? 0 : 1);
}

function skillsFit(career, profile) {
  const list = modeOf(profile) === 'student' ? starterSkillsOf(career) : career.skills;
  return list.length ? list.filter(id => profile.skills.includes(id)).length / list.length : 0;
}

// Small stable hash: careers with exactly the same match are ordered by it instead of by
// their place in the catalogue, so no career is always first just because it is listed first.
function tieKey(id, areas) {
  let h = 2166136261;
  const s = id + ':' + AREA_IDS.map(a => areas[a]).join(',');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Baseline match for every career, best first. Weights depend on the path (see WEIGHTS in config.mjs). */
export function rankCareers(areas, profile) {
  const W = WEIGHTS[modeOf(profile)];
  return CAREERS.map(c => {
    const i = interestFit(areas, c.w).fit;
    const k = skillsFit(c, profile);
    const x = extraFit(c, profile);
    const match = Math.min(99, Math.round(100 * (W.interest * i + W.skills * k + W.extra * x)));
    return { id: c.id, field: c.field, match, parts: { interest: Math.round(i * 100), skills: Math.round(k * 100), extra: Math.round(x * 100) }, tie: tieKey(c.id, areas) };
  }).sort((a, b) => b.match - a.match || b.parts.interest - a.parts.interest || a.tie - b.tie);
}

/** The best n careers, with at most LIMITS.perField from one field, so the list shows real options. */
export function pickTop(list, n = LIMITS.topN, perField = LIMITS.perField) {
  const out = [], count = {};
  for (const r of list) {
    const f = CAREER_BY_ID[r.id].field;
    if ((count[f] || 0) >= perField) continue;
    out.push(r); count[f] = (count[f] || 0) + 1;
    if (out.length === n) break;
  }
  return out;
}

/** Skills of the career that the person does not have yet, in priority order. */
export function skillGap(careerId, ownedSkills) {
  const c = CAREER_BY_ID[careerId];
  const missing = c.skills.filter(id => !ownedSkills.includes(id));
  return missing.map((id, i) => ({ id, name: SKILLS[id].name, priority: i < 2 ? 'High' : 'Medium' }));
}

/** The career's two most important interest areas and the person's scores in them. */
export function topAreasFor(careerId, areas, n = 2) {
  const c = CAREER_BY_ID[careerId];
  return AREA_IDS.map((id, i) => ({ id, name: AREA_NAME[id], weight: c.w[i], score: areas[id] }))
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, n);
}

/** The person's own strongest areas, highest first. */
export function strongestAreas(areas, n = 2) {
  return AREA_IDS.map(id => ({ id, name: AREA_NAME[id], score: areas[id] })).sort((a, b) => b.score - a.score).slice(0, n);
}

/** A plain sentence that needs no AI. Used when the AI is off or fails. */
export function rulesSummary(careerId, areas) {
  const c = CAREER_BY_ID[careerId];
  const [a, b] = topAreasFor(careerId, areas, 2);
  return `${c.name} work asks most for ${a.name} and ${b.name} interests. Your scores there are ${a.score} and ${b.score} out of 100.`;
}

/** Checkable facts for the "Why this match" screen. Everything here is computed, nothing is guessed. */
export function matchFacts(careerId, result) {
  const c = CAREER_BY_ID[careerId];
  const { areas, profile } = result;
  const answers = result.answers || null;
  const top = topAreasFor(careerId, areas, 2);
  const have = c.skills.filter(id => profile.skills.includes(id)).map(id => SKILLS[id].name);
  const subj = c.subjects.filter(s => (profile.subjects || []).includes(s));
  let strong = [];
  if (answers) {
    const wanted = new Set(top.map(t => t.id));
    strong = QUESTIONS.filter(q => wanted.has(q.area) && answers[q.id - 1] >= 3)
      .sort((x, y) => answers[y.id - 1] - answers[x.id - 1] || x.id - y.id)
      .slice(0, 2).map(q => ({ n: q.id, text: q.text, value: answers[q.id - 1] }));
  }
  const mode = modeOf(profile);
  return {
    mode, top, have, haveTotal: c.skills.length, subjects: subj, strong,
    field: FIELD_BY_ID[c.field].name,
    sameField: mode === 'pro' && profile.field === c.field,
  };
}

/* ---------- AI: build the request, check the answer ---------- */

/** What is sent to the AI. No name, no e-mail, no birth date: the browser never has them in this request. */
export function aiPayload(input, areas, ranked) {
  const p = input.profile;
  const person = modeOf(p) === 'student'
    ? { path: 'student', grade: p.grade, school_subjects_liked: p.subjects }
    : { path: 'professional', current_field: p.field === 'other' ? 'other' : FIELD_BY_ID[p.field].name, experience: p.exp, education: p.edu, goal: GOALS.find(g => g.id === p.goal).name };
  return {
    person: {
      ...person,
      interest_scores_0_to_100: areas,
      skills_already_have: p.skills.map(id => SKILLS[id].name),
      note_from_person: input.note || '',
    },
    careers: ranked.slice(0, LIMITS.aiCandidates).map(r => {
      const c = CAREER_BY_ID[r.id];
      return {
        id: c.id, name: c.name, field: FIELD_BY_ID[c.field].name, baseline_match: r.match,
        area_importance_0_to_3: Object.fromEntries(AREA_IDS.map((id, i) => [id, c.w[i]])),
        core_skills: c.skills.map(id => ({ id, name: SKILLS[id].name })),
      };
    }),
  };
}

const clean = s => String(s || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Check the AI's answer. We trust the AI for wording and for small ranking changes only:
 * careers it was not offered are dropped, each match may move at most AI_MAX_SHIFT points from the baseline,
 * no more than LIMITS.perField careers from one field are kept, and skills to build must be real core skills
 * of that career that the person does not have. Returns the top matches, or null when the answer is not usable.
 */
export function sanitizeAi(raw, ranked, input) {
  const list = raw && Array.isArray(raw.matches) ? raw.matches : null;
  if (!list) return null;
  const offered = ranked.slice(0, LIMITS.aiCandidates);
  const base = Object.fromEntries(offered.map(r => [r.id, r.match]));
  const seen = new Set();
  const perField = {};
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object' || !(m.id in base) || seen.has(m.id)) continue;
    const num = Number(m.match);
    if (!Number.isFinite(num)) continue;
    const f = CAREER_BY_ID[m.id].field;
    if ((perField[f] || 0) >= LIMITS.perField) continue;
    seen.add(m.id); perField[f] = (perField[f] || 0) + 1;
    const b = base[m.id];
    const match = Math.max(0, Math.min(99, Math.max(b - AI_MAX_SHIFT, Math.min(b + AI_MAX_SHIFT, Math.round(num)))));
    const allowed = new Set(skillGap(m.id, input.profile.skills).map(g => g.id));
    let build = (Array.isArray(m.build) ? m.build : []).filter((id, i, a) => allowed.has(id) && a.indexOf(id) === i).slice(0, 3);
    if (!build.length) build = skillGap(m.id, input.profile.skills).slice(0, 3).map(g => g.id);
    out.push({ id: m.id, match, summary: clean(m.summary).slice(0, 280), build, aiAdjusted: match !== b });
    if (out.length === LIMITS.topN) break;
  }
  if (out.length < 3) return null;
  for (const r of ranked) {                       // fill up to topN from the baseline, same field rule
    if (out.length >= LIMITS.topN) break;
    if (seen.has(r.id) || (perField[r.field] || 0) >= LIMITS.perField) continue;
    seen.add(r.id); perField[r.field] = (perField[r.field] || 0) + 1;
    out.push(rulesMatch(r, input, null));
  }
  return out.sort((a, b) => b.match - a.match).slice(0, LIMITS.topN);
}

function rulesMatch(r, input, areas) {
  return {
    id: r.id, match: r.match,
    summary: areas ? rulesSummary(r.id, areas) : '',
    build: skillGap(r.id, input.profile.skills).slice(0, 3).map(g => g.id),
    aiAdjusted: false,
  };
}

/* ---------- results ---------- */

/** Result from the rules only (AI off, missing, too slow, or unreachable). */
export function rulesResult(input, aiStatus, where = 'server') {
  const areas = scoreAreas(input.answers);
  const ranked = rankCareers(areas, input.profile);
  const matches = pickTop(ranked).map(r => rulesMatch(r, input, areas));
  return makeResult(input, areas, matches, 'rules', aiStatus, where);
}

/** Result after a usable AI answer. */
export function aiResult(input, areas, matches) {
  const filled = matches.map(m => ({ ...m, summary: m.summary || rulesSummary(m.id, areas) }));
  return makeResult(input, areas, filled, 'ai', 'ok', 'server');
}

function makeResult(input, areas, matches, source, aiStatus, where) {
  return {
    v: 2,
    source,            // 'ai' | 'rules'
    aiStatus,          // 'ok' | 'off' | 'no_key' | 'timeout' | 'error' | 'unreachable' | 'busy'
    where,             // 'server' | 'device'
    flat: isFlat(areas),
    areas,
    matches,
    profile: input.profile,
    catalogueVersion: CATALOGUE_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/** Check a result that comes back from storage before the browser trusts it. */
export function looksLikeResult(r) {
  return !!r && typeof r === 'object' && (r.v === 1 || r.v === 2) && r.areas && Array.isArray(r.matches) && r.matches.length > 0
    && r.matches.every(m => CAREER_BY_ID[m.id] && Number.isFinite(m.match)) && r.profile && Array.isArray(r.profile.skills);
}
