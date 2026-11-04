// 30 statements, 5 per interest area, written by the Cognita team.
// This is a guidance tool, not a validated psychological test.
// Order: one question per area in turn, so the student never answers five similar questions in a row.

const BY_AREA = {
  analytical: [
    'I enjoy spotting patterns in numbers or tables.',
    'I like finding out why something does not work.',
    'I enjoy puzzles that need careful logic.',
    'I check facts before I trust a claim.',
    'I like turning a mess of information into a clear conclusion.',
  ],
  technical: [
    'I like taking things apart to see how they work.',
    'I enjoy learning how apps, computers or machines work.',
    'I like building something that really works, step by step.',
    'I am happy to spend time fixing small technical problems.',
    'I enjoy learning new tools and settings.',
  ],
  organising: [
    'I prefer clear steps to open-ended tasks.',
    'I like making plans and keeping to them.',
    'I keep my notes, files and things in order.',
    'I notice small mistakes that other people miss.',
    'I like checking that rules and procedures are followed.',
  ],
  creative: [
    'I enjoy designing how things look and feel.',
    'I often come up with ideas that are different from other people’s.',
    'I like drawing, writing, music or making things.',
    'I enjoy improving the look of a page or a poster.',
    'I like imagining new products or stories.',
  ],
  enterprising: [
    'I like leading a group toward a goal.',
    'I enjoy persuading people of my idea.',
    'I am ready to take a risk to try something new.',
    'I like to decide what matters most and what to do first.',
    'I like the idea of starting my own project or business.',
  ],
  social: [
    'I like explaining my ideas to other people.',
    'I enjoy helping people with their problems.',
    'I listen carefully when someone talks about a difficulty.',
    'I enjoy working in a team.',
    'I like teaching someone how to do something.',
  ],
};

const ORDER = Object.keys(BY_AREA);
export const QUESTIONS = [];
for (let i = 0; i < 5; i++) {
  for (const area of ORDER) {
    QUESTIONS.push({ id: QUESTIONS.length + 1, area, text: BY_AREA[area][i] });
  }
}
