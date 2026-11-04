import { handleFeedback } from '../lib/handlers.mjs';
export default async (req) => handleFeedback(req, process.env, fetch);
export const config = { path: '/api/feedback' };
