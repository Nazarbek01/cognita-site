// Skill vocabulary used by the profile, the skill-gap analysis and the roadmap.
// starter: true  -> a broad skill a school student can tick in the profile.
//                   Professionals can tick any skill.
// group    -> how the professional profile groups the list.
// Every skill has a short roadmap step: what it is and three things inside it.
// No courses, links or prices are listed on purpose: we do not invent resources.

const S = (name, group, starter, d, pts) => ({ name, group, starter, d, pts });

export const SKILL_GROUPS = [
  'General', 'Digital & data', 'Design & media', 'Business & money', 'Health & science',
  'Engineering & building', 'People & services', 'Hands-on & outdoors',
];

export const SKILLS = {
  /* ---------- broad skills (students can tick these) ---------- */
  excel:    S('Excel basics', 'Digital & data', true, 'Spreadsheets are the first data tool in almost every office job.', ['Tables and formulas', 'Sorting and filtering', 'Simple charts']),
  prog:     S('Programming basics', 'Digital & data', true, 'Learn to give a computer exact instructions in one language.', ['Variables and conditions', 'Loops and functions', 'Reading and fixing errors']),
  logic:    S('Logic & problem solving', 'General', true, 'Break a problem into small steps and check each one.', ['Splitting a problem into steps', 'Testing edge cases', 'Explaining your solution']),
  math:     S('Mathematics', 'General', true, 'The language behind data, engineering, money and science.', ['Algebra and functions', 'Probability basics', 'Reading graphs']),
  write:    S('Writing', 'General', true, 'Clear writing makes your ideas and your work easy to use.', ['Short, clear sentences', 'Structure: start, middle, end', 'Editing your own text']),
  speak:    S('Public speaking', 'General', true, 'Present an idea so that other people understand and remember it.', ['Preparing a two-minute talk', 'Voice, pace and pauses', 'Answering questions']),
  team:     S('Teamwork', 'General', true, 'Most careers are team sports. Learn to share work and feedback.', ['Sharing tasks fairly', 'Giving and receiving feedback', 'Solving disagreements']),
  draw:     S('Drawing & visual design', 'Design & media', true, 'Make things clear and pleasant to look at.', ['Layout, spacing and contrast', 'Colour and type basics', 'Sketching ideas quickly']),
  plan:     S('Planning & organising', 'General', true, 'Turn a big goal into tasks, dates and checkpoints.', ['Breaking a goal into tasks', 'Estimating time', 'Tracking progress']),
  detail:   S('Attention to detail', 'General', true, 'Catch the small mistakes before other people do.', ['Proofreading', 'Checklists', 'Spotting inconsistencies']),
  research: S('Research & curiosity', 'General', true, 'Ask a good question, then find and check the answer.', ['Asking a precise question', 'Finding and checking sources', 'Summarising findings']),
  lang:     S('Foreign languages', 'General', true, 'Another language opens more jobs, people and sources.', ['Everyday conversation', 'Reading real texts', 'Writing short messages']),
  care:     S('Caring for people', 'People & services', true, 'Notice what someone needs and help in a calm, respectful way.', ['Listening without judging', 'Staying calm under stress', 'Respecting privacy and dignity']),
  hands:    S('Working with tools', 'Hands-on & outdoors', true, 'Use hand and power tools safely and accurately.', ['Measuring and marking', 'Using common tools safely', 'Finishing work neatly']),
  fit:      S('Physical fitness', 'Hands-on & outdoors', true, 'Strength and stamina for jobs that keep you on your feet.', ['Regular training habit', 'Lifting and moving safely', 'Recovery and sleep']),
  music:    S('Music', 'Design & media', true, 'Play, sing or produce music with skill and regular practice.', ['Rhythm and pitch', 'Reading or writing music', 'Practising with a plan']),
  photo:    S('Photo & video', 'Design & media', true, 'Capture images and clips that tell a story.', ['Light and framing', 'Camera settings', 'Basic editing']),
  science:  S('Biology & chemistry', 'Health & science', true, 'The base for medicine, science, food and farming careers.', ['Cells and the human body', 'Chemical reactions', 'Safe lab habits']),
  persuade: S('Persuasion & sales', 'Business & money', true, 'Help people see why an idea or product is right for them.', ['Understanding what people need', 'Explaining the benefits', 'Handling objections politely']),
  lead:     S('Leading a team', 'People & services', true, 'Help a group agree on a goal and reach it together.', ['Setting a clear goal', 'Sharing roles', 'Keeping people motivated']),
  cook:     S('Cooking', 'Hands-on & outdoors', true, 'Prepare food safely, tastily and on time.', ['Knife skills and hygiene', 'Basic cooking methods', 'Following and adapting recipes']),

  /* ---------- digital & data ---------- */
  sql:      S('SQL', 'Digital & data', false, 'Learn to ask a database questions. Most analysis starts with getting the right rows out of a table.', ['SELECT, WHERE and ORDER BY', 'JOIN two tables', 'GROUP BY and totals']),
  stats:    S('Statistics', 'Digital & data', false, 'Learn to tell a real pattern from noise.', ['Mean, median and spread', 'Distributions and correlation', 'Basic hypothesis testing']),
  dataviz:  S('Data visualisation', 'Digital & data', false, 'Turn numbers into charts that people understand at a glance.', ['Choosing the right chart', 'Building a dashboard', 'Telling a story with data']),
  git:      S('Git & version control', 'Digital & data', false, 'Keep the history of your work and collaborate without overwriting each other.', ['Commits and branches', 'Pull requests', 'Resolving conflicts']),
  web:      S('HTML, CSS & JavaScript', 'Digital & data', false, 'The three languages every website is built from.', ['Page structure with HTML', 'Layout and style with CSS', 'Interactivity with JavaScript']),
  mobile:   S('Mobile app development', 'Digital & data', false, 'Build apps that run on phones and feel natural there.', ['Screens and navigation', 'Working with phone features', 'Publishing a test build']),
  gameeng:  S('Game engines', 'Digital & data', false, 'Use a game engine to turn ideas into playable worlds.', ['Scenes, objects and physics', 'Scripting game logic', 'Testing and balancing gameplay']),
  cloud:    S('Cloud & automation', 'Digital & data', false, 'Run software on servers and automate how it is built and released.', ['Servers and containers', 'Automated builds and tests', 'Monitoring and alerts']),
  net:      S('Networks & security basics', 'Digital & data', false, 'Understand how data travels and how it gets attacked.', ['IP, DNS and HTTP', 'Common attacks', 'Passwords and updates']),
  testing:  S('Testing basics', 'Digital & data', false, 'Find problems in software before the users do.', ['Writing test cases', 'Clear bug reports', 'Manual and automated tests']),
  os:       S('Computers & operating systems', 'Digital & data', false, 'Know how computers, devices and their systems work, and how to fix them.', ['Hardware parts', 'Installing and updating systems', 'Finding the cause of a fault']),
  ml:       S('Machine learning basics', 'Digital & data', false, 'Understand how a model learns from examples and how to judge it.', ['Training and test data', 'Simple models', 'Measuring results']),
  db:       S('Database design', 'Digital & data', false, 'Design tables so that data stays correct, fast and safe.', ['Tables, keys and relations', 'Backups and recovery', 'Access rights']),

  /* ---------- design & media ---------- */
  tools:    S('Design tools', 'Design & media', false, 'Learn one design tool well enough to turn an idea into a finished piece.', ['Frames, shapes and text', 'Components and styles', 'Exporting your work']),
  uxr:      S('User research', 'Design & media', false, 'Find out what people need before you design or build.', ['Interviews', 'Usability tests', 'Turning notes into insights']),
  anim:     S('Animation & 3D', 'Design & media', false, 'Bring characters and objects to life with movement.', ['Timing and spacing', 'Keyframes and rigs', '3D modelling basics']),
  sewing:   S('Sewing & pattern making', 'Design & media', false, 'Turn a sketch into clothes that fit and last.', ['Fabrics and their behaviour', 'Patterns and measurements', 'Machine and hand sewing']),
  edit:     S('Video editing', 'Design & media', false, 'Cut raw footage into a clear, engaging story.', ['Cutting and pacing', 'Sound and music', 'Colour and titles']),
  audio:    S('Sound recording & mixing', 'Design & media', false, 'Record clean sound and balance it into a finished mix.', ['Microphones and placement', 'Levels and noise', 'Mixing and mastering basics']),
  film:     S('Filmmaking', 'Design & media', false, 'Plan, shoot and lead the making of a film.', ['Script and storyboard', 'Directing actors and crew', 'Working within a budget']),
  perform:  S('Stage performance', 'Design & media', false, 'Perform in front of an audience with confidence and control.', ['Voice and body', 'Rehearsal habits', 'Handling nerves']),
  story:    S('Storytelling', 'Design & media', false, 'Build stories that people want to follow to the end.', ['Characters and conflict', 'Structure and pacing', 'Rewriting drafts']),
  report:   S('Interviewing & reporting', 'Design & media', false, 'Find facts, check them and report them fairly.', ['Preparing questions', 'Checking facts with two sources', 'Writing to a deadline']),
  trans:    S('Translation', 'Design & media', false, 'Carry meaning, not just words, from one language to another.', ['Terminology lists', 'Tone and register', 'Checking your own translation']),
  social:   S('Social media', 'Design & media', false, 'Plan and publish content that a real audience follows.', ['Platforms and formats', 'Content calendar', 'Reading the statistics']),

  /* ---------- business & money ---------- */
  mkt:      S('Marketing basics', 'Business & money', false, 'Know who you talk to, what you say and where you say it.', ['Audience and message', 'Channels and campaigns', 'Measuring results']),
  agile:    S('Agile basics', 'Business & money', false, 'Deliver in small steps and learn from each one.', ['Backlogs and sprints', 'Daily check-ins', 'Retrospectives']),
  reqs:     S('Requirements analysis', 'Business & money', false, 'Write down what a system must do so that everyone agrees.', ['User stories', 'Process diagrams', 'Acceptance criteria']),
  budget:   S('Budgeting', 'Business & money', false, 'Plan money so that a project or a business stays on track.', ['Income and costs', 'Simple budget table', 'Tracking spending']),
  negotiate:S('Negotiation', 'Business & money', false, 'Reach agreements that both sides can accept.', ['Preparing your limits', 'Listening for interests', 'Closing clearly in writing']),
  strategy: S('Business strategy', 'Business & money', false, 'Decide where an organisation should go and how to get there.', ['Market and competitors', 'Goals and priorities', 'Measuring progress']),
  hr:       S('Hiring & HR basics', 'Business & money', false, 'Find the right people and help them grow at work.', ['Job descriptions', 'Structured interviews', 'Onboarding new people']),
  acct:     S('Accounting', 'Business & money', false, 'Record money in and out so that the numbers are true and complete.', ['Double-entry bookkeeping', 'Financial statements', 'Taxes and deadlines']),
  fin:      S('Financial analysis', 'Business & money', false, 'Judge how healthy a business or an investment is.', ['Reading financial statements', 'Ratios and trends', 'Simple forecasts']),
  econ:     S('Economics', 'Business & money', false, 'Understand how people, firms and countries make choices about resources.', ['Supply and demand', 'Inflation and growth', 'Reading economic data']),
  law:      S('Law basics', 'Business & money', false, 'Know how laws are made, read and applied.', ['Sources of law', 'Reading a contract', 'Rights and duties']),
  policy:   S('Public policy', 'Business & money', false, 'Turn public goals into rules and services that work.', ['How the state is organised', 'Writing a policy brief', 'Checking the effect of a policy']),

  /* ---------- health & science ---------- */
  anatomy:  S('Anatomy & physiology', 'Health & science', false, 'Know how the human body is built and how it works.', ['Body systems', 'Normal and abnormal signs', 'Medical terms']),
  firstaid: S('First aid', 'Health & science', false, 'Act correctly in the first minutes of an emergency.', ['Checking breathing and pulse', 'Stopping bleeding', 'Calling for help clearly']),
  pharma:   S('Pharmacology', 'Health & science', false, 'Understand how medicines work, help and harm.', ['Groups of medicines', 'Doses and side effects', 'Interactions']),
  lab:      S('Lab techniques', 'Health & science', false, 'Run tests in a lab carefully and record them honestly.', ['Samples and safety', 'Using lab equipment', 'Recording results']),
  psych:    S('Psychology', 'Health & science', false, 'Understand how people think, feel and behave.', ['Development and personality', 'Stress and emotions', 'Research methods']),
  nutrition:S('Nutrition', 'Health & science', false, 'Know how food affects health and performance.', ['Nutrients and energy', 'Balanced meals', 'Special diets']),
  animals:  S('Animal care', 'Health & science', false, 'Handle and care for animals safely and kindly.', ['Animal behaviour', 'Feeding and hygiene', 'Signs of illness']),
  bio:      S('Biology (advanced)', 'Health & science', false, 'Go deeper into living things, from cells to ecosystems.', ['Cell biology', 'Genetics', 'Ecology']),
  chem:     S('Chemistry (advanced)', 'Health & science', false, 'Go deeper into substances and how they change.', ['Organic chemistry', 'Analytical methods', 'Lab safety rules']),
  phys:     S('Physics', 'Health & science', false, 'Understand the laws behind motion, energy and matter.', ['Mechanics', 'Electricity and magnetism', 'Experiments and errors']),
  env:      S('Environmental science', 'Health & science', false, 'Study nature and how people change it.', ['Ecosystems', 'Pollution and its sources', 'Measuring the environment']),
  earth:    S('Geology & earth science', 'Health & science', false, 'Read rocks, soil and landscapes to understand the Earth.', ['Rocks and minerals', 'Maps and sections', 'Field sampling']),

  /* ---------- engineering & building ---------- */
  cad:      S('CAD & technical drawing', 'Engineering & building', false, 'Draw parts and buildings precisely on a computer.', ['2D drawings and views', '3D models', 'Dimensions and standards']),
  mech:     S('Mechanics', 'Engineering & building', false, 'Understand forces, motion and how machines carry loads.', ['Forces and moments', 'Materials and strength', 'Simple machine design']),
  elec:     S('Electrical circuits', 'Engineering & building', false, 'Understand how current flows and how circuits are designed.', ['Voltage, current and resistance', 'Circuit diagrams', 'Measuring with a multimeter']),
  robo:     S('Electronics & robotics', 'Engineering & building', false, 'Combine sensors, motors and code into machines that act on their own.', ['Sensors and motors', 'Microcontrollers', 'Control loops']),
  safety:   S('Health & safety rules', 'Engineering & building', false, 'Work so that nobody gets hurt.', ['Spotting hazards', 'Protective equipment', 'Reporting incidents']),
  build:    S('Building materials & codes', 'Engineering & building', false, 'Know what buildings are made of and the rules they must meet.', ['Materials and their properties', 'Building codes', 'Reading construction drawings']),
  survey:   S('Surveying & maps', 'Engineering & building', false, 'Measure land precisely and turn it into maps.', ['Survey instruments', 'Coordinates and maps', 'GIS basics']),

  /* ---------- people & services ---------- */
  teach:    S('Teaching & explaining', 'People & services', false, 'Help other people learn something new and remember it.', ['Planning a lesson', 'Explaining step by step', 'Checking understanding']),
  child:    S('Child development', 'People & services', false, 'Know how children grow, learn and play.', ['Stages of development', 'Learning through play', 'Keeping children safe']),
  counsel:  S('Counselling & listening', 'People & services', false, 'Support people to understand their situation and choose a next step.', ['Active listening', 'Asking open questions', 'Professional boundaries']),
  customer: S('Customer service', 'People & services', false, 'Help customers kindly and solve their problems.', ['Friendly first contact', 'Solving complaints', 'Following up']),
  emergency:S('Emergency response', 'People & services', false, 'Stay calm and act by procedure when something goes wrong.', ['Assessing a scene', 'Procedures and radio calls', 'Working under pressure']),
  aviation: S('Aviation rules & navigation', 'People & services', false, 'Know how aircraft are flown, guided and kept safe.', ['Air law and procedures', 'Navigation and weather', 'Radio communication']),
  logistics:S('Supply chain basics', 'People & services', false, 'Move goods from where they are made to where they are needed.', ['Warehousing and stock', 'Transport planning', 'Tracking deliveries']),
  service:  S('Guest service', 'People & services', false, 'Make guests feel welcome and looked after.', ['Welcoming guests', 'Handling requests', 'Teamwork on a busy shift']),
  events:   S('Event planning', 'People & services', false, 'Plan and run events that go smoothly.', ['Venue, timing and budget', 'Suppliers and contracts', 'Running the day itself']),
  coach:    S('Coaching', 'People & services', false, 'Help someone improve with training plans and feedback.', ['Setting training goals', 'Planning sessions', 'Motivating and correcting']),
  sportsci: S('Sports science', 'People & services', false, 'Understand training, recovery and injury prevention.', ['How muscles adapt', 'Warm-up and recovery', 'Avoiding injuries']),
  hair:     S('Hair cutting & styling', 'People & services', false, 'Cut, colour and style hair to what the client wants.', ['Tools and hygiene', 'Basic cuts', 'Talking with clients']),
  makeup:   S('Makeup', 'People & services', false, 'Apply makeup for everyday, stage, film and photo.', ['Skin types and hygiene', 'Colour and contrast', 'Different looks for different light']),

  /* ---------- hands-on & outdoors ---------- */
  drive:    S('Safe driving', 'Hands-on & outdoors', false, 'Drive safely and efficiently for many hours.', ['Road rules', 'Vehicle checks', 'Planning rest and routes']),
  agri:     S('Plant & soil science', 'Hands-on & outdoors', false, 'Grow healthy crops and keep soil fertile.', ['Soil and fertilisers', 'Plant pests and diseases', 'Seasons and harvest']),
  wiring:   S('Electrical installation', 'Hands-on & outdoors', false, 'Install and repair wiring safely and to the rules.', ['Cables and protection', 'Wiring diagrams', 'Testing before switching on']),
  plumbing: S('Pipework & plumbing', 'Hands-on & outdoors', false, 'Install and fix the systems that bring water in and take it away.', ['Pipes and fittings', 'Heating systems', 'Finding leaks']),
  welding:  S('Welding', 'Hands-on & outdoors', false, 'Join metal parts strongly and safely.', ['Welding methods', 'Reading weld symbols', 'Protective equipment']),
  wood:     S('Woodwork', 'Hands-on & outdoors', false, 'Measure, cut and join wood into things that last.', ['Wood types', 'Joints', 'Sanding and finishing']),
  engines:  S('Engine & car repair', 'Hands-on & outdoors', false, 'Find and fix faults in cars and engines.', ['How an engine works', 'Diagnostic tools', 'Servicing and parts']),
  kitchen:  S('Professional kitchen', 'Hands-on & outdoors', false, 'Cook at speed and keep a kitchen safe and clean.', ['Food safety rules', 'Preparing ingredients in advance', 'Working a busy service']),
};

export const SKILL_IDS = Object.keys(SKILLS);
export const STARTER_IDS = SKILL_IDS.filter(id => SKILLS[id].starter);
