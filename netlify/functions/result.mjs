import { handleResult } from '../lib/handlers.mjs';
export default async (req) => handleResult(req, process.env, fetch);
export const config = { path: '/api/result' };
