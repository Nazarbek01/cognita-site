import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, SUBJECTS, GRADES } from '../public/shared/config.mjs';
import { QUESTIONS } from '../public/shared/questions.mjs';
import { CAREERS } from '../public/shared/careers.mjs';
import { SKILLS, STARTER_IDS } from '../public/shared/skills.mjs';
import * as E from '../public/shared/engine.mjs';
import { goodInput } from './helpers.mjs';

test('questions: 30, five per area, ids 1..30, no two neighbours from the same area', () => {
  assert.equal(QUESTIONS.length, 30);
  assert.deepEqual(QUESTIONS.map(q => q.id), Array.from({ length: 30 }, (_, i) => i + 1));
  for (const a of AREAS) assert.equal(QUESTIONS.filter(q => q.area === a.id).length, 5, a.id);
  for (let i = 1; i < 30; i++) assert.notEqual(QUESTIONS[i].area, QUESTIONS[i - 1].area);
  assert.equal(new Set(QUESTIONS.map(q => q.text)).size, 30);
});

test('catalogue: every career is complete and consistent', () => {
  assert.equal(new Set(CAREERS.map(c => c.id)).size, CAREERS.length);
  for (const c of CAREERS) {
    assert.equal(c.w.length, 6, c.id);
    assert.ok(c.w.every(n => Number.isInteger(n) && n >= 0 && n <= 3) && c.w.some(n => n === 3), c.id);
    assert.ok(c.skills.every(s => SKILLS[s]), `${c.id} skills exist`);
    assert.equal(new Set(c.skills).size, c.skills.length);
    assert.ok(c.skills.filter(s => SKILLS[s].starter).length >= 2, `${c.id} has starter skills`);
    assert.ok(c.subjects.every(s => SUBJECTS.includes(s)), `${c.id} subjects`);
    assert.equal(c.tasks.length, 4);
    assert.ok(c.summary && c.education && c.portfolio);
    assert.ok(!/\d{3,}|\$|USD|salary/i.test(c.summary + c.education + c.tasks.join(' ')), `${c.id} has no invented numbers`);
  }
});

test('scoreAreas: all 4 -> 100, all 0 -> 0, one area only', () => {
  const all = v => Array(30).fill(v);
  assert.ok(Object.values(E.scoreAreas(all(4))).every(v => v === 100));
  assert.ok(Object.values(E.scoreAreas(all(0))).every(v => v === 0));
  const onlyCreative = QUESTIONS.map(q => (q.area === 'creative' ? 4 : 0));
  const s = E.scoreAreas(onlyCreative);
  assert.equal(s.creative, 100);
  assert.equal(s.analytical, 0);
});

test('rankCareers: interests drive the order, scores stay below 100, list is sorted', () => {
  const profile = { grade: '11', subjects: [], skills: [] };
  const tech = E.rankCareers(E.scoreAreas(QUESTIONS.map(q => (q.area === 'technical' || q.area === 'analytical' ? 4 : 0))), profile);
  assert.ok(['software-engineer', 'data-scientist', 'cybersecurity-analyst', 'qa-engineer'].includes(tech[0].id), tech[0].id);
  const art = E.rankCareers(E.scoreAreas(QUESTIONS.map(q => (q.area === 'creative' ? 4 : 0))), profile);
  assert.ok(['graphic-designer', 'content-writer', 'ux-designer'].includes(art[0].id), art[0].id);
  for (const list of [tech, art]) {
    assert.equal(list.length, CAREERS.length);
    assert.ok(list.every((r, i) => i === 0 || list[i - 1].match >= r.match));
    assert.ok(list.every(r => r.match >= 0 && r.match <= 99));
  }
  // owning the core skills and liking the subjects raises the match
  const areas = E.scoreAreas(Array(30).fill(2));
  const base = E.rankCareers(areas, profile).find(r => r.id === 'data-analyst').match;
  const more = E.rankCareers(areas, { grade: '11', subjects: ['Mathematics', 'Informatics'], skills: ['excel', 'math', 'logic', 'detail', 'speak'] }).find(r => r.id === 'data-analyst').match;
  assert.ok(more > base);
});

test('skillGap: priorities and ownership', () => {
  const gap = E.skillGap('data-analyst', ['excel', 'math']);
  assert.deepEqual(gap.map(g => g.id).slice(0, 3), ['sql', 'stats', 'dataviz']);
  assert.equal(gap[0].priority, 'High');
  assert.equal(gap[1].priority, 'High');
  assert.equal(gap[2].priority, 'Medium');
  assert.ok(!gap.some(g => g.id === 'excel'));
});

test('validateInput: accepts good input, rejects bad input', () => {
  assert.equal(E.validateInput(goodInput()).ok, true);
  const bad = [
    { ...goodInput(), answers: Array(29).fill(1) },
    { ...goodInput(), answers: Array(30).fill(5) },
    { ...goodInput(), answers: Array(30).fill('1') },
    { ...goodInput(), answers: Array(30).fill(1.5) },
    { ...goodInput(), profile: { grade: '5', subjects: [], skills: [] } },
    { ...goodInput(), profile: { grade: '11', subjects: ['Cooking'], skills: [] } },
    { ...goodInput(), profile: { grade: '11', subjects: [], skills: ['sql'] } },            // sql is not a starter skill
    { ...goodInput(), profile: { grade: '11', subjects: ['Art', 'Art'], skills: [] } },
    { ...goodInput(), profile: null },
    null, 'x', [],
  ];
  for (const b of bad) assert.equal(E.validateInput(b).ok, false, JSON.stringify(b)?.slice(0, 80));
  assert.ok(GRADES.includes('11') && STARTER_IDS.includes('excel'));
});

test('scrubNote removes e-mails, phone numbers, control characters and cuts the length', () => {
  const s = E.scrubNote('I am Aigerim, mail me: aigerim@example.com or call +7 701 234 56 78.\u0000\n I like maps');
  assert.ok(!s.includes('@') && !/701/.test(s) && !s.includes('\u0000'));
  assert.ok(s.includes('I like maps'));
  assert.equal(E.scrubNote('x'.repeat(1000)).length, 300);
  assert.equal(E.scrubNote(42), '');
});

test('sanitizeAi: clamps shifts, drops unknown ids, filters skills, needs at least 3 valid', () => {
  const input = E.validateInput(goodInput()).value;
  const areas = E.scoreAreas(input.answers);
  const ranked = E.rankCareers(areas, input.profile);
  const base = id => ranked.find(r => r.id === id).match;
  const raw = {
    matches: [
      { id: ranked[0].id, match: 99, summary: ' Good\nfit ', build: ['sql', 'NOPE', 'sql', 'excel'] },
      { id: ranked[1].id, match: 0, summary: 'x'.repeat(500), build: [] },
      { id: 'astronaut', match: 90, summary: 'no', build: [] },
      { id: ranked[2].id, match: 'abc', summary: 'bad number', build: [] },
      { id: ranked[1].id, match: 50, summary: 'duplicate', build: [] },
      { id: ranked[3].id, match: base(ranked[3].id), summary: 'ok', build: [] },
    ],
  };
  const out = E.sanitizeAi(raw, ranked, input);
  assert.ok(out && out.length === 5);
  const first = out.find(m => m.id === ranked[0].id);
  assert.ok(first.match <= base(ranked[0].id) + 15 && first.match <= 99);
  assert.equal(first.summary, 'Good fit');
  assert.ok(first.build.every(id => E.skillGap(first.id, input.profile.skills).some(g => g.id === id)));
  assert.ok(!first.build.includes('excel'));               // student already has it
  const second = out.find(m => m.id === ranked[1].id);
  assert.ok(second.match >= base(ranked[1].id) - 15);
  assert.ok(second.summary.length <= 280);
  assert.ok(!out.some(m => m.id === 'astronaut'));
  assert.ok(out.every((m, i) => i === 0 || out[i - 1].match >= m.match));
  assert.equal(new Set(out.map(m => m.id)).size, out.length);
  assert.equal(E.sanitizeAi({ matches: [raw.matches[0]] }, ranked, input), null);
  assert.equal(E.sanitizeAi(null, ranked, input), null);
  assert.equal(E.sanitizeAi({ matches: 'x' }, ranked, input), null);
});

test('rulesResult and aiResult make results the browser accepts', () => {
  const input = E.validateInput(goodInput()).value;
  const r = E.rulesResult(input, 'no_key');
  assert.equal(r.source, 'rules');
  assert.equal(r.aiStatus, 'no_key');
  assert.equal(r.matches.length, 5);
  assert.ok(r.matches.every(m => m.summary.length > 10));
  assert.ok(E.looksLikeResult(r));
  assert.ok(!E.looksLikeResult({ v: 1, areas: {}, matches: [{ id: 'nope', match: 1 }], profile: { skills: [] } }));
  assert.ok(!E.looksLikeResult(null));
  const device = E.rulesResult(input, 'unreachable', 'device');
  assert.equal(device.where, 'device');
});

test('matchFacts uses only real data', () => {
  const input = E.validateInput(goodInput()).value;
  const r = { ...E.rulesResult(input, 'off'), answers: input.answers };
  const f = E.matchFacts('data-analyst', r);
  assert.equal(f.top.length, 2);
  assert.deepEqual(f.have.sort(), ['Excel basics', 'Logic & problem solving']);
  assert.deepEqual(f.subjects.sort(), ['Informatics', 'Mathematics']);
  assert.ok(f.strong.every(s => s.value >= 3));
});
