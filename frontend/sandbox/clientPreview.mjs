import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { trustedBrowserRequest } from './policy.mjs';

// Local preview only. Fixed private files, never copied into public or a build.
export function clientPreviewPlugin(directory) {
  return {
    name: 'local-client-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/sandbox-client-preview/')) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        if (!local || !['127.0.0.1:5175', 'localhost:5175'].includes(req.headers.host) || !trustedBrowserRequest(req.headers)) {
          res.statusCode = 403; return res.end();
        }
        if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
        const filename = req.url.slice('/sandbox-client-preview/'.length);
        if (!['maslaka.zip', 'insurance.xlsx'].includes(filename)) { res.statusCode = 404; return res.end(); }
        try {
          const data = await readFile(join(directory, filename));
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(data);
        } catch { res.statusCode = 404; res.end(); }
      });
    },
  };
}
