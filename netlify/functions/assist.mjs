import { handleAssist } from '../lib/handlers.mjs';
export default async (req) => handleAssist(req, process.env, fetch);
export const config = { path: '/api/assist' };
