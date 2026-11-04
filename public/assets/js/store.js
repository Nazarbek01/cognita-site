// Everything the visitor does is kept in this browser (localStorage), so a refresh never loses progress.
// All reads and writes are wrapped: storage can be blocked (private mode) and the site must still work.

const KEY = 'cognita.v1';

export const fresh = () => ({
  v: 1,
  name: '',
  consent: { privacy: false, ai: true, save: true },
  profile: { grade: '11', subjects: [], skills: [], note: '' },
  answers: Array(30).fill(null),
  q: 0,
  result: null,          // the last result (with .answers added)
  code: null,            // private result code, if saved
  saveStatus: 'off',     // 'saved' | 'off' | 'not_configured' | 'error'
  focus: null,           // career id used for roadmap, dashboard
  roadmap: {},           // { careerId: { done: ['sql'] } }
  feedback: {},          // { 'CODE:careerId': 5 }
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return fresh();
    const f = fresh();
    return { ...f, ...s, consent: { ...f.consent, ...s.consent }, profile: { ...f.profile, ...s.profile } };
  } catch { return fresh(); }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: keep working in memory */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
