// Shared by the browser and the Netlify functions. No secrets here.

export const CATALOGUE_VERSION = 1;

// Six interest areas. The order matters: it is the order of the weight arrays in careers.mjs.
export const AREAS = [
  { id: 'analytical',   name: 'Analytical',   color: '#2563FF', blurb: 'Patterns, logic and evidence' },
  { id: 'technical',    name: 'Technical',    color: '#00B8E6', blurb: 'How machines and software work' },
  { id: 'organising',   name: 'Organising',   color: '#16A34A', blurb: 'Order, plans and accuracy' },
  { id: 'creative',     name: 'Creative',     color: '#8B4DFF', blurb: 'Ideas, design and making' },
  { id: 'enterprising', name: 'Enterprising', color: '#FF9933', blurb: 'Leading, deciding and persuading' },
  { id: 'social',       name: 'Social',       color: '#FF4DA6', blurb: 'Helping, teaching and teamwork' },
];

export const SCALE = ['Not at all', 'Rarely', 'Sometimes', 'Often', 'Very much'];

export const GRADES = ['9', '10', '11', 'College or university'];

export const SUBJECTS = ['Mathematics', 'Informatics', 'Physics', 'Biology', 'Chemistry', 'Literature', 'History', 'Art'];

export const LIMITS = {
  noteMax: 300,        // optional free text for the AI
  commentMax: 500,     // feedback comment
  questions: 30,
  topN: 5,
};

export const AI_MAX_SHIFT = 15; // the AI may move a baseline match by at most this many points
