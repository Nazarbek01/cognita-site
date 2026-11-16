import test from 'node:test';
import assert from 'node:assert/strict';
import { freshQuests, ensureToday, toggleQuest, questEvent, currentStreak, levelOf, useAiQuests, prevDay, dailyQuests } from '../public/shared/quests.mjs';
import { KZ_SECTORS, KZ_NATIONAL, marketFor, FIELD_SECTOR, CAREER_SECTOR, KZ_SECTOR_BY_ID } from '../public/shared/market.mjs';
import { CAREERS, CAREER_BY_ID, FIELD_IDS } from '../public/shared/careers.mjs';

const step = { id: 'sql', title: 'SQL', pts: ['SELECT and WHERE', 'JOIN two tables', 'GROUP BY'] };

test('quests: three quests a day, new list on a new day, XP kept', () => {
  const q = freshQuests();
  ensureToday(q, 'Data Analyst', step, '2026-11-17');
  assert.equal(q.list.length, 3);
  toggleQuest(q, 'learn', '2026-11-17');
  assert.equal(q.xp, 10);
  ensureToday(q, 'Data Analyst', step, '2026-11-17');
  assert.ok(q.list.find(x => x.id === 'learn').done, 'same day keeps progress');
  ensureToday(q, 'Data Analyst', step, '2026-11-18');
  assert.ok(q.list.every(x => !x.done) && q.xp === 10, 'new day: fresh quests, XP stays');
  assert.notDeepEqual(dailyQuests('A', step, '2026-11-17').map(x => x.title), dailyQuests('A', step, '2026-11-18').map(x => x.title));
});

test('quests: streak grows day by day and breaks after a missed day', () => {
  const q = freshQuests();
  for (const d of ['2026-11-15', '2026-11-16', '2026-11-17']) { ensureToday(q, 'X', step, d); toggleQuest(q, 'learn', d); }
  assert.equal(q.streak, 3);
  assert.ok(q.badges.streak3 && q.badges.first);
  assert.equal(currentStreak(q, '2026-11-18'), 3, 'still alive the next day');
  assert.equal(currentStreak(q, '2026-11-19'), 0, 'broken after a missed day');
  ensureToday(q, 'X', step, '2026-11-19'); toggleQuest(q, 'learn', '2026-11-19');
  assert.equal(q.streak, 1);
  assert.equal(q.best, 3);
  assert.equal(prevDay('2026-03-01'), '2026-02-28');
});

test('quests: unticking takes XP back; a full day gives a badge; levels', () => {
  const q = freshQuests(); const d = '2026-11-17';
  ensureToday(q, 'X', step, d);
  toggleQuest(q, 'practice', d); toggleQuest(q, 'practice', d);
  assert.equal(q.xp, 0);
  for (const x of q.list) toggleQuest(q, x.id, d);
  assert.ok(q.badges.fullday);
  assert.deepEqual(levelOf(250), { level: 3, into: 50, need: 100 });
});

test('quests: AI tool events complete the matching quest once; AI quests keep finished ones', () => {
  const q = freshQuests();
  let d = '2026-11-17';
  for (let i = 0; i < 6 && !(ensureToday(q, 'X', step, d).list.find(x => x.event === 'mentor')); i++) { d = `2026-11-${18 + i}`; q.day = ''; }
  const won = questEvent(q, 'mentor', d);
  assert.ok(won.some(b => b.id === 'mentor'));
  assert.ok(q.list.find(x => x.event === 'mentor').done);
  assert.equal(questEvent(q, 'mentor', d).length, 0, 'no second reward');
  toggleQuest(q, 'learn', d);
  useAiQuests(q, [{ type: 'practice', title: 'A', minutes: 10 }, { type: 'reflect', title: 'B', minutes: 5 }, { type: 'learn', title: 'C', minutes: 5 }], d);
  assert.equal(q.list.length, 3);
  assert.equal(q.list.filter(x => x.done).length, 2, 'finished quests stay, so XP cannot be farmed');
});

test('market: every career has an official sector, numbers are consistent', () => {
  for (const f of FIELD_IDS) assert.ok(KZ_SECTOR_BY_ID[FIELD_SECTOR[f]], f);
  for (const id of Object.keys(CAREER_SECTOR)) { assert.ok(CAREER_BY_ID[id], id); assert.ok(KZ_SECTOR_BY_ID[CAREER_SECTOR[id]], id); }
  for (const c of CAREERS) { const m = marketFor(c); assert.ok(m.sector && m.rank >= 1 && m.rank <= KZ_SECTORS.length, c.id); }
  assert.ok(KZ_SECTORS.every((s, i) => i === 0 || KZ_SECTORS[i - 1].wage >= s.wage), 'sorted from high to low');
  assert.equal(marketFor(CAREER_BY_ID['petroleum-engineer']).sector.id, 'mining');
  assert.ok(KZ_NATIONAL.median < KZ_NATIONAL.average);
});
