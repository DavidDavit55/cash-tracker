import { clientPreviewPlugin } from './sandbox/clientPreview.mjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { workflowPlugin } from './sandbox/workflow.mjs';
import { allowedRequest, trustedBrowserRequest } from './sandbox/policy.mjs';

// Existing production API, reached only through the restricted local gateway.
const target = 'https://cash-tracker-production-35dd.up.railway.app/api';
function gateway() {
  return {
    name: 'networth-sandbox-read-only',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/sandbox-api/')) return next();
        res.setHeader('Cache-Control', 'no-store');
        const reject = (status, error) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error })); };
        if (!trustedBrowserRequest(req.headers)) return reject(403, 'גישה מותרת רק מהסנדבוקס המקומי');
        const path = req.url.slice('/sandbox-api'.length);
        const pathname = path.split('?')[0];
        if (!allowedRequest(req.method, pathname)) return reject(403, 'הסנדבוקס חוסם שינוי נתונים בפרודקשן');
        try {
          let body;
          if (req.method === 'POST') {
            const chunks = []; let length = 0;
            for await (const chunk of req) { length += chunk.length; if (length > 4096) return reject(413, 'בקשה גדולה מדי'); chunks.push(chunk); }
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (typeof parsed.phone !== 'string' || parsed.phone.length > 30) return reject(400, 'מספר טלפון לא תקין');
            body = JSON.stringify({ phone: parsed.phone, ...(pathname.endsWith('/check') ? { code: String(parsed.code || '').slice(0, 12) } : {}) });
          }
          const response = await fetch(target + path, {
            method: req.method,
            headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) },
            body, redirect: 'error', signal: AbortSignal.timeout(25000),
          });
          res.statusCode = response.status;
          res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          reject(502, 'לא ניתן להגיע לשרת כרגע. הנתונים לא שונו. אפשר לנסות שוב.');
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), gateway(), clientPreviewPlugin(fileURLToPath(new URL('./.sandbox-state/client-preview', import.meta.url))), workflowPlugin(fileURLToPath(new URL('./.sandbox-state', import.meta.url)))],
  server: { host: '127.0.0.1', port: 5175, strictPort: true, open: false, fs: { deny: ['**/.sandbox-state/**', '**/.env', '**/.env.*', '**/*.{crt,pem}'] } },
  build: { outDir: 'sandbox-dist', rolldownOptions: { input: 'sandbox.html' } },
});
