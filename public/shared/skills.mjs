// Skill vocabulary used by the profile, the skill-gap analysis and the roadmap.
// starter: true  -> the student can tick it in the profile ("skills you already have").
// Every skill has a short roadmap step: what it is and three things inside it.
// No courses, links or prices are listed on purpose: we do not invent resources.

export const SKILLS = {
  excel:    { name: 'Excel basics',            starter: true,  d: 'Spreadsheets are the first data tool most analysts use.', pts: ['Tables and formulas', 'Sorting and filtering', 'Simple charts'] },
  prog:     { name: 'Programming basics',      starter: true,  d: 'Learn to give a computer exact instructions in one language.', pts: ['Variables and conditions', 'Loops and functions', 'Reading and fixing errors'] },
  logic:    { name: 'Logic & problem solving', starter: true,  d: 'Break a problem into small steps and check each one.', pts: ['Splitting a problem into steps', 'Testing edge cases', 'Explaining your solution'] },
  math:     { name: 'Mathematics',             starter: true,  d: 'The language behind data, algorithms and models.', pts: ['Algebra and functions', 'Probability basics', 'Reading graphs'] },
  write:    { name: 'Writing',                 starter: true,  d: 'Clear writing makes your ideas and your work easy to use.', pts: ['Short, clear sentences', 'Structure: start, middle, end', 'Editing your own text'] },
  speak:    { name: 'Public speaking',         starter: true,  d: 'Present an idea so that other people understand and remember it.', pts: ['Preparing a two-minute talk', 'Voice, pace and pauses', 'Answering questions'] },
  team:     { name: 'Teamwork',                starter: true,  d: 'Most careers are team sports. Learn to share work and feedback.', pts: ['Sharing tasks fairly', 'Giving and receiving feedback', 'Solving disagreements'] },
  draw:     { name: 'Drawing & visual design', starter: true,  d: 'Make things clear and pleasant to look at.', pts: ['Layout, spacing and contrast', 'Colour and type basics', 'Sketching ideas quickly'] },
  plan:     { name: 'Planning & organising',   starter: true,  d: 'Turn a big goal into tasks, dates and checkpoints.', pts: ['Breaking a goal into tasks', 'Estimating time', 'Tracking progress'] },
  detail:   { name: 'Attention to detail',     starter: true,  d: 'Catch the small mistakes before other people do.', pts: ['Proofreading', 'Checklists', 'Spotting inconsistencies'] },
  research: { name: 'Research & curiosity',    starter: true,  d: 'Ask a good question, then find and check the answer.', pts: ['Asking a precise question', 'Finding and checking sources', 'Summarising findings'] },

  sql:      { name: 'SQL',                     starter: false, d: 'Learn to ask a database questions. Most analysis starts with getting the right rows out of a table.', pts: ['SELECT, WHERE and ORDER BY', 'JOIN two tables', 'GROUP BY and totals'] },
  stats:    { name: 'Statistics',              starter: false, d: 'Learn to tell a real pattern from noise.', pts: ['Mean, median and spread', 'Distributions and correlation', 'Basic hypothesis testing'] },
  dataviz:  { name: 'Data visualisation',      starter: false, d: 'Turn numbers into charts that people understand at a glance.', pts: ['Choosing the right chart', 'Building a dashboard', 'Telling a story with data'] },
  git:      { name: 'Git & version control',   starter: false, d: 'Keep the history of your work and collaborate without overwriting each other.', pts: ['Commits and branches', 'Pull requests', 'Resolving conflicts'] },
  net:      { name: 'Networks & security basics', starter: false, d: 'Understand how data travels and how it gets attacked.', pts: ['IP, DNS and HTTP', 'Common attacks', 'Passwords and updates'] },
  tools:    { name: 'Design tools',            starter: false, d: 'Learn one design tool well enough to turn an idea into a screen.', pts: ['Frames, shapes and text', 'Components and styles', 'Clickable prototypes'] },
  uxr:      { name: 'User research',           starter: false, d: 'Find out what people need before you design or build.', pts: ['Interviews', 'Usability tests', 'Turning notes into insights'] },
  ml:       { name: 'Machine learning basics', starter: false, d: 'Understand how a model learns from examples and how to judge it.', pts: ['Training and test data', 'Simple models', 'Measuring results'] },
  mkt:      { name: 'Marketing basics',        starter: false, d: 'Know who you talk to, what you say and where you say it.', pts: ['Audience and message', 'Channels and campaigns', 'Measuring results'] },
  testing:  { name: 'Testing basics',          starter: false, d: 'Find problems in software before the users do.', pts: ['Writing test cases', 'Clear bug reports', 'Manual and automated tests'] },
  agile:    { name: 'Agile basics',            starter: false, d: 'Deliver in small steps and learn from each one.', pts: ['Backlogs and sprints', 'Daily check-ins', 'Retrospectives'] },
  reqs:     { name: 'Requirements analysis',   starter: false, d: 'Write down what a system must do so that everyone agrees.', pts: ['User stories', 'Process diagrams', 'Acceptance criteria'] },
};

export const SKILL_IDS = Object.keys(SKILLS);
export const STARTER_IDS = SKILL_IDS.filter(id => SKILLS[id].starter);
