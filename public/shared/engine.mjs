// The matching engine. Pure functions, no network, no browser APIs.
// It runs on the server (to prepare and check the AI request) and in the browser
// (as the "on this device" fallback when the server cannot be reached).

import { AREAS, LIMITS, AI_MAX_SHIFT, CATALOGUE_VERSION, GRADES, SUBJECTS } from './config.mjs';
import { QUESTIONS } from './questions.mjs';
import { CAREERS, CAREER_BY_ID } from './careers.mjs';
import { SKILLS, STARTER_IDS } from './skills.mjs';

const AREA_IDS = AREAS.map(a => a.id);
const AREA_NAME = Object.fromEntries(AREAS.map(a => [a.id, a.name]));

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

/** Check what the browser sent. Returns { ok, value } or { ok:false, error }. */
export function validateInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object.' };
  const { answers, profile, note } = body;
  if (!Array.isArray(answers) || answers.length !== LIMITS.questions || !answers.every(a => isInt(a, 0, 4)))
    return { ok: false, error: 'answers must be 30 whole numbers from 0 to 4.' };
  if (!profile || typeof profile !== 'object') return { ok: false, error: 'profile is missing.' };
  if (!GRADES.includes(profile.grade)) return { ok: false, error: 'grade is not valid.' };
  if (!uniqueIn(profile.subjects, SUBJECTS, SUBJECTS.length)) return { ok: false, error: 'subjects are not valid.' };
  if (!uniqueIn(profile.skills, STARTER_IDS, STARTER_IDS.length)) return { ok: false, error: 'skills are not valid.' };
  return {
    ok: true,
    value: {
      answers: answers.slice(),
      profile: { grade: profile.grade, subjects: profile.subjects.slice(), skills: profile.skills.slice() },
      note: scrubNote(note),
      useAi: body.useAi !== false,
      save: body.save === true,
    },
  };
}

/* ---------- scoring ---------- */

/** 30 answers (0..4) -> score 0..100 for each of the six areas. */
export function scoreAreas(answers) {
  const sum = Object.fromEntries(AREA_IDS.map(id => [id, 0]));
  QUESTIONS.forEach((q, i) => { sum[q.area] += answers[i]; });
  return Object.fromEntries(AREA_IDS.map(id => [id, Math.round((sum[id] / 20) * 100)]));
}

const starterSkillsOf = career => career.skills.filter(id => SKILLS[id].starter);

/** Baseline match for every career: 70% interests, 20% skills you have, 10% school subjects you like. */
export function rankCareers(areas, profile) {
  return CAREERS.map(c => {
    const wSum = c.w.reduce((a, b) => a + b, 0);
    const interest = AREA_IDS.reduce((s, id, i) => s + c.w[i] * (areas[id] / 100), 0) / wSum;
    const starters = starterSkillsOf(c);
    const skillsFrac = starters.length ? starters.filter(id => profile.skills.includes(id)).length / starters.length : 0;
    const subjFrac = c.subjects.length ? c.subjects.filter(s => profile.subjects.includes(s)).length / c.subjects.length : 0;
    const match = Math.min(99, Math.round(100 * (0.7 * interest + 0.2 * skillsFrac + 0.1 * subjFrac)));
    return { id: c.id, match, parts: { interest: Math.round(interest * 100), skills: Math.round(skillsFrac * 100), subjects: Math.round(subjFrac * 100) } };
  }).sort((a, b) => b.match - a.match || a.id.localeCompare(b.id));
}

/** Skills of the career that the student does not have yet, in priority order. */
export function skillGap(careerId, ownedSkills) {
  const c = CAREER_BY_ID[careerId];
  const missing = c.skills.filter(id => !ownedSkills.includes(id));
  return missing.map((id, i) => ({ id, name: SKILLS[id].name, priority: i < 2 ? 'High' : 'Medium' }));
}

/** The career's two most important interest areas and the student's scores in them. */
export function topAreasFor(careerId, areas, n = 2) {
  const c = CAREER_BY_ID[careerId];
  return AREA_IDS.map((id, i) => ({ id, name: AREA_NAME[id], weight: c.w[i], score: areas[id] }))
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, n);
}

/** A plain sentence that needs no AI. Used when the AI is off or fails. */
export function rulesSummary(careerId, areas) {
  const c = CAREER_BY_ID[careerId];
  const [a, b] = topAreasFor(careerId, areas, 2);
  return `Your ${a.name} (${a.score}) and ${b.name} (${b.score}) scores line up with what ${c.name} work asks for most.`;
}

/** Checkable facts for the "Why this match" screen. Everything here is computed, nothing is guessed. */
export function matchFacts(careerId, result) {
  const c = CAREER_BY_ID[careerId];
  const { areas, profile } = result;
  const answers = result.answers || null;
  const top = topAreasFor(careerId, areas, 2);
  const have = c.skills.filter(id => profile.skills.includes(id)).map(id => SKILLS[id].name);
  const subj = c.subjects.filter(s => profile.subjects.includes(s));
  let strong = [];
  if (answers) {
    const wanted = new Set(top.map(t => t.id));
    strong = QUESTIONS.filter(q => wanted.has(q.area) && answers[q.id - 1] >= 3)
      .sort((x, y) => answers[y.id - 1] - answers[x.id - 1] || x.id - y.id)
      .slice(0, 2).map(q => ({ n: q.id, text: q.text, value: answers[q.id - 1] }));
  }
  return { top, have, haveTotal: c.skills.length, subjects: subj, strong };
}

/* ---------- AI: build the request, check the answer ---------- */

/** What is sent to the AI. No name, no e-mail, no birth date: the browser never has them in this request. */
export function aiPayload(input, areas, ranked) {
  return {
    student: {
      grade: input.profile.grade,
      interest_scores_0_to_100: areas,
      school_subjects_liked: input.profile.subjects,
      skills_already_have: input.profile.skills.map(id => SKILLS[id].name),
      note_from_student: input.note || '',
    },
    careers: ranked.map(r => {
      const c = CAREER_BY_ID[r.id];
      return {
        id: c.id, name: c.name, baseline_match: r.match,
        area_importance_0_to_3: Object.fromEntries(AREA_IDS.map((id, i) => [id, c.w[i]])),
        core_skills: c.skills.map(id => ({ id, name: SKILLS[id].name })),
      };
    }),
  };
}

const clean = s => String(s || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Check the AI's answer. We trust the AI for wording and for small ranking changes only:
 * unknown careers are dropped, each match may move at most AI_MAX_SHIFT points from the baseline,
 * and skills to build must be real core skills of that career that the student does not have.
 * Returns the top matches, or null when the answer is not usable.
 */
export function sanitizeAi(raw, ranked, input) {
  const list = raw && Array.isArray(raw.matches) ? raw.matches : null;
  if (!list) return null;
  const base = Object.fromEntries(ranked.map(r => [r.id, r.match]));
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object' || !CAREER_BY_ID[m.id] || seen.has(m.id)) continue;
    const num = Number(m.match);
    if (!Number.isFinite(num)) continue;
    seen.add(m.id);
    const b = base[m.id];
    const match = Math.max(0, Math.min(99, Math.max(b - AI_MAX_SHIFT, Math.min(b + AI_MAX_SHIFT, Math.round(num)))));
    const allowed = new Set(skillGap(m.id, input.profile.skills).map(g => g.id));
    let build = (Array.isArray(m.build) ? m.build : []).filter((id, i, a) => allowed.has(id) && a.indexOf(id) === i).slice(0, 3);
    if (!build.length) build = skillGap(m.id, input.profile.skills).slice(0, 3).map(g => g.id);
    out.push({ id: m.id, match, summary: clean(m.summary).slice(0, 280), build, aiAdjusted: match !== b });
  }
  if (out.length < 3) return null;
  for (const r of ranked) {                       // fill up to topN from the baseline
    if (out.length >= LIMITS.topN) break;
    if (!seen.has(r.id)) out.push(rulesMatch(r, input, null));
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
  const matches = ranked.slice(0, LIMITS.topN).map(r => rulesMatch(r, input, areas));
  return makeResult(input, areas, matches, 'rules', aiStatus, where);
}

/** Result after a usable AI answer. */
export function aiResult(input, areas, matches) {
  const filled = matches.map(m => ({ ...m, summary: m.summary || rulesSummary(m.id, areas) }));
  return makeResult(input, areas, filled, 'ai', 'ok', 'server');
}

function makeResult(input, areas, matches, source, aiStatus, where) {
  return {
    v: 1,
    source,            // 'ai' | 'rules'
    aiStatus,          // 'ok' | 'off' | 'no_key' | 'timeout' | 'error' | 'unreachable'
    where,             // 'server' | 'device'
    areas,
    matches,
    profile: input.profile,
    catalogueVersion: CATALOGUE_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/** Check a result that comes back from storage before the browser trusts it. */
export function looksLikeResult(r) {
  return !!r && typeof r === 'object' && r.v === 1 && r.areas && Array.isArray(r.matches) && r.matches.length > 0
    && r.matches.every(m => CAREER_BY_ID[m.id] && Number.isFinite(m.match)) && r.profile && Array.isArray(r.profile.skills);
}
