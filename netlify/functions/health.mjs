import { handleHealth } from '../lib/handlers.mjs';
export default async (req) => handleHealth(req, process.env, fetch);
export const config = { path: '/api/health' };
