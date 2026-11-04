import { handleMatch } from '../lib/handlers.mjs';
export default async (req) => handleMatch(req, process.env, fetch);
export const config = { path: '/api/match' };
