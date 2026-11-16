// Quests & rewards. Pure functions, no browser APIs: the browser keeps the state in localStorage.
// Every day: three small quests made from the current roadmap step. Points (XP) make levels,
// days in a row make a streak, and real actions on the site earn badges.

export const XP = { learn: 10, practice: 20, reflect: 10, tool: 15 };
export const LEVEL_XP = 100;

export const BADGES = [
  { id: 'first',     name: 'First step',        img: 'glowing-star',       how: 'Finish your first quest.' },
  { id: 'fullday',   name: 'Full day',          img: 'check-mark-button',  how: 'Finish all three quests in one day.' },
  { id: 'streak3',   name: '3 days in a row',   img: 'sports-medal',       how: 'Finish a quest three days in a row.' },
  { id: 'streak7',   name: '7 days in a row',   img: 'trophy',             how: 'Finish a quest seven days in a row.' },
  { id: 'level3',    name: 'Level 3',           img: 'rocket',             how: `Collect ${LEVEL_XP * 2} XP.` },
  { id: 'step',      name: 'Roadmap step done', img: 'world-map',          how: 'Mark a roadmap step as done.' },
  { id: 'plan',      name: 'Planner',           img: 'books',              how: 'Make an AI learning plan.' },
  { id: 'mentor',    name: 'Curious mind',      img: 'speech-balloon',     how: 'Ask the AI mentor a question.' },
  { id: 'compare',   name: 'Career explorer',   img: 'balance-scale',      how: 'Compare two careers with AI.' },
  { id: 'interview', name: 'Interview ready',   img: 'speaking-head',      how: 'Get feedback on an interview answer.' },
];
export const BADGE_BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b]));

// The third quest of the day rotates through the AI tools. `event` completes it automatically.
const TOOL_QUESTS = [
  { event: 'mentor',    go: '/mentor',    title: c => `Ask the AI mentor one question about ${c}` },
  { event: 'interview', go: '/interview', title: c => `Answer one practice interview question for ${c}` },
  { event: 'plan',      go: '/roadmap',   title: () => 'Make an AI learning plan for your current roadmap step' },
  { event: 'compare',   go: '/compare',   title: c => `Compare ${c} with one more career` },
  { event: null,        go: null,         title: () => 'Write two sentences about what you learned today' },
];

/** Local date as YYYY-MM-DD (the day changes at the person's midnight, not UTC). */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

const dayNumber = key => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

export const freshQuests = () => ({ xp: 0, day: '', list: [], streak: 0, best: 0, last: '', badges: {}, done: 0, ai: false });

/**
 * Today's three quests for a roadmap step.
 * @param {string} careerName
 * @param {{id:string,title:string,pts:string[]}} step  the current roadmap step
 * @param {string} today  dayKey()
 */
export function dailyQuests(careerName, step, today) {
  const n = dayNumber(today);
  const pts = step.pts && step.pts.length ? step.pts : [step.title];
  const tool = TOOL_QUESTS[n % TOOL_QUESTS.length];
  return [
    { id: 'learn', type: 'learn', xp: XP.learn, minutes: 15, title: `Learn: ${pts[n % pts.length]}`, done: false },
    { id: 'practice', type: 'practice', xp: XP.practice, minutes: 20, title: `Practise “${step.title}”: ${pts[(n + 1) % pts.length].toLowerCase()}`, done: false },
    tool.event
      ? { id: 'tool', type: 'tool', xp: XP.tool, minutes: 10, title: tool.title(careerName), event: tool.event, go: tool.go, done: false }
      : { id: 'tool', type: 'reflect', xp: XP.reflect, minutes: 5, title: tool.title(careerName), done: false },
  ];
}

/** Start a new day if the date changed. Keeps XP, streak and badges. */
export function ensureToday(q, careerName, step, today) {
  if (q.day === today && q.list.length) return q;
  q.day = today; q.ai = false;
  q.list = dailyQuests(careerName, step, today);
  return q;
}

/** The streak shown today: it breaks when a whole day was missed. */
export const currentStreak = (q, today) => (q.last === today || q.last === prevDay(today) ? q.streak : 0);

export const levelOf = xp => ({ level: Math.floor(xp / LEVEL_XP) + 1, into: xp % LEVEL_XP, need: LEVEL_XP });

/** Give a badge once. Returns the badge if it is new. */
export function award(q, id, today) {
  if (!BADGE_BY_ID[id] || q.badges[id]) return null;
  q.badges[id] = today;
  return BADGE_BY_ID[id];
}

/** Tick or untick one of today's quests. Returns the badges earned by this action. */
export function toggleQuest(q, id, today) {
  const quest = q.list.find(x => x.id === id);
  if (!quest || q.day !== today) return [];
  quest.done = !quest.done;
  if (!quest.done) { q.xp = Math.max(0, q.xp - quest.xp); q.done = Math.max(0, q.done - 1); return []; }
  return complete(q, quest, today);
}

function complete(q, quest, today) {
  q.xp += quest.xp;
  q.done += 1;
  if (q.last !== today) {
    q.streak = q.last === prevDay(today) ? q.streak + 1 : 1;
    q.last = today;
    q.best = Math.max(q.best, q.streak);
  }
  const won = [award(q, 'first', today)];
  if (q.list.every(x => x.done)) won.push(award(q, 'fullday', today));
  if (q.streak >= 3) won.push(award(q, 'streak3', today));
  if (q.streak >= 7) won.push(award(q, 'streak7', today));
  if (levelOf(q.xp).level >= 3) won.push(award(q, 'level3', today));
  return won.filter(Boolean);
}

/** Something happened on the site (an AI tool was used, a step was done): badge + matching tool quest. */
export function questEvent(q, event, today) {
  const won = [award(q, event, today)];
  const quest = q.day === today && q.list.find(x => x.event === event && !x.done);
  if (quest) { quest.done = true; won.push(...complete(q, quest, today)); }
  return won.filter(Boolean);
}

/** Replace today's unfinished quests with the AI's ones (finished quests stay, so XP cannot be farmed). */
export function useAiQuests(q, aiList, today) {
  if (q.day !== today) return q;
  const kept = q.list.filter(x => x.done);
  const fresh = aiList.slice(0, 3 - kept.length).map((a, i) => ({
    id: 'ai' + i, type: a.type, xp: XP[a.type] || XP.learn, minutes: a.minutes, title: a.title, done: false,
  }));
  q.list = [...kept, ...fresh];
  q.ai = true;
  return q;
}
