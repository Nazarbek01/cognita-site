// Local preview server. Not used on Netlify (Netlify serves /public and runs netlify/functions itself).
//
//   node dev-server.mjs            real mode: reads .env, talks to the real OpenAI and Notion
//   node dev-server.mjs --mock     demo mode: fake OpenAI and Notion kept in memory (no keys needed)
//
// Mock mode exists to try the screens and for the automatic browser tests. Its "AI" answers are
// canned text, so never judge the AI by it.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMatch, handleResult, handleFeedback, handleHealth } from './netlify/lib/handlers.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const MOCK = process.argv.includes('--mock') || process.env.COGNITA_MOCK === '1';
const PORT = Number(process.env.PORT) || Number((process.argv.find(a => a.startsWith('--port=')) || '').slice(7)) || 8888;

function readEnvFile() {
  const out = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file: fine */ }
  return out;
}

let env = { ...readEnvFile(), ...process.env };
let fetchFn = fetch;
let mockLog = null;

if (MOCK) {
  const { makeFetch, ENV } = await import('./test/helpers.mjs');
  const m = makeFetch({ ai: process.env.MOCK_AI || 'ok', notion: process.env.MOCK_NOTION || 'ok' });
  fetchFn = m.fetchFn; mockLog = m.log;
  env = { ...ENV, RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '1000', OPENAI_MODEL: '', ADMIN_TOKEN: 'dev' };
  if (process.env.MOCK_NO_KEY === '1') env.OPENAI_API_KEY = '';
  if (process.env.MOCK_NO_NOTION === '1') env.NOTION_TOKEN = '';
  console.log('\n  MOCK MODE: OpenAI and Notion are fakes kept in memory. AI texts are canned. Do not use this to judge real results.\n');
}

// the same security headers as netlify.toml, so CSP problems show up here first
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const CSP = (toml.match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || '';
const SECURITY = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const API = { '/api/match': handleMatch, '/api/result': handleResult, '/api/feedback': handleFeedback, '/api/health': handleHealth };

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function serveApi(req, res, url) {
  const handler = API[url.pathname];
  if (!handler) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"ok":false,"error":"Unknown endpoint."}'); }
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(url, { method: req.method, headers, body });
  const response = await handler(request, env, fetchFn);
  const out = Object.fromEntries(response.headers);
  if (MOCK) out['x-cognita-mock'] = '1';
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { ...SECURITY, 'content-type': 'text/html; charset=utf-8' });
      return res.end(fs.existsSync(path.join(PUBLIC, '404.html')) ? fs.readFileSync(path.join(PUBLIC, '404.html')) : 'Not found');
    }
    res.writeHead(200, { ...SECURITY, 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/__mock_log' && MOCK) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(mockLog)); }
    if (url.pathname.startsWith('/api/')) return await serveApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(PORT, () => console.log(`Cognita is running at http://localhost:${PORT}${MOCK ? '  (mock mode)' : ''}`));
