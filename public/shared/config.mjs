// Shared by the browser and the Netlify functions. No secrets here.

export const CATALOGUE_VERSION = 2;

// Six interest areas. The order matters: it is the order of the weight arrays in careers.mjs.
// Colours are CSS variables defined in tokens.css (only that file holds hex values).
export const AREAS = [
  { id: 'analytical',   name: 'Analytical',   color: 'var(--area-analytical)',   img: 'magnifying-glass-tilted-left', blurb: 'Patterns, logic and evidence' },
  { id: 'technical',    name: 'Technical',    color: 'var(--area-technical)',    img: 'gear',         blurb: 'How machines and software work' },
  { id: 'organising',   name: 'Organising',   color: 'var(--area-organising)',   img: 'clipboard',    blurb: 'Order, plans and accuracy' },
  { id: 'creative',     name: 'Creative',     color: 'var(--area-creative)',     img: 'artist-palette', blurb: 'Ideas, design and making' },
  { id: 'enterprising', name: 'Enterprising', color: 'var(--area-enterprising)', img: 'rocket',       blurb: 'Leading, deciding and persuading' },
  { id: 'social',       name: 'Social',       color: 'var(--area-social)',       img: 'handshake',    blurb: 'Helping, teaching and teamwork' },
];

export const SCALE = ['Not at all', 'Rarely', 'Sometimes', 'Often', 'Very much'];

/* ---------- who is taking the assessment ---------- */

export const MODES = ['student', 'pro'];

// student path
export const GRADES = ['9', '10', '11', 'College or university'];
export const SUBJECTS = [
  'Mathematics', 'Informatics', 'Physics', 'Chemistry', 'Biology', 'Geography', 'History',
  'Literature', 'Languages', 'Economics', 'Art', 'Music', 'Physical Education', 'Technology',
];

// professional path
export const EXPERIENCE = ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', 'More than 10 years'];
export const EDUCATION = ['School', 'College', 'Bachelor’s degree', 'Master’s degree or higher'];
export const GOALS = [
  { id: 'any',    name: 'Open to anything' },
  { id: 'stay',   name: 'Grow in my current field' },
  { id: 'change', name: 'Move to a new field' },
];

/* ---------- limits and weights ---------- */

export const LIMITS = {
  noteMax: 300,        // optional free text for the AI
  commentMax: 500,     // feedback comment
  questions: 30,
  topN: 5,
  perField: 2,         // at most this many careers from one field in the top five
  aiCandidates: 15,    // how many careers (best baseline first) the AI may choose from
};

export const AI_MAX_SHIFT = 15; // the AI may move a baseline match by at most this many points

// How the baseline match is made (shown to people on the "How is this match calculated?" panel).
export const WEIGHTS = {
  student: { interest: 0.70, skills: 0.20, extra: 0.10 },   // extra = school subjects you like
  pro:     { interest: 0.60, skills: 0.30, extra: 0.10 },   // extra = your goal (same field or a new one)
};
export const SHAPE_SHARE = 0.65;   // inside the interest part: 65% profile shape, 35% level
export const FLAT_RANGE = 12;      // area scores closer together than this = "no clear preference"
