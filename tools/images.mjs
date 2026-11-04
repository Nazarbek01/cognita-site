// Lists every 3D picture the site needs (one slug per line).
// Used by tools/fetch_images.py, which downloads them from Microsoft's Fluent Emoji repository (MIT licence).
import { CAREERS, FIELDS } from '../public/shared/careers.mjs';
import { AREAS } from '../public/shared/config.mjs';

// pictures used by the page layouts (views.js)
export const EXTRA = [
  'woman-student', 'man-student', 'man-office-worker', 'waving-hand', 'glowing-star', 'key', 'pencil',
  'puzzle-piece', 'hourglass-not-done', 'warning', 'thought-balloon', 'books', 'red-heart', 'pushpin',
  'magnifying-glass-tilted-left', 'clipboard', 'handshake', 'artist-palette', 'crystal-ball', 'compass',
  'world-map', 'sparkles', 'locked', 'robot', 'light-bulb', 'bullseye', 'rocket', 'graduation-cap', 'memo',
];

const slugs = new Set([...CAREERS.map(c => c.img), ...FIELDS.map(f => f.img), ...AREAS.map(a => a.img), ...EXTRA]);
if (import.meta.url === `file://${process.argv[1]}`) console.log([...slugs].sort().join('\n'));
export default slugs;
