import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openStore,createStoreHandler} from './local-crm-store.mjs';
import {createPublicCatalogueHandler} from './public-fund-catalogue.mjs';
const publicCatalogue=createPublicCatalogueHandler();
const root = process.cwd();
const localStore=openStore(path.join(process.env.LOCALAPPDATA||os.tmpdir(),'NETWORTH','crm-sandbox'));
const port=Number(process.env.CRM_SANDBOX_PORT||5208);
const handleStore=createStoreHandler(localStore,port);
const files = {
  '/preview-source/har': 'C:/Users/david/Downloads/HbResults-2026-02-12_10-11-47-AM.xlsx',
  '/preview-source/maslaka': 'C:/Users/david/Downloads/מסלקה_אבי אברהם בן חמו.zip',
};
const server = await createServer({
  root: path.join(root, 'frontend'), configLoader: 'native',
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root] } },
  plugins: [{ name: 'isolated-report-preview', configureServer(dev) {
    dev.middlewares.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Browser remains isolated. Only the fixed public catalogue is read server-side.
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:${port}; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'`);
    res.setHeader('Referrer-Policy', 'no-referrer');
      if(await publicCatalogue(req,res))return;
      if(await handleStore(req,res))return;
      if(req.url==='/crm-sandbox'){
        res.setHeader('Content-Type','text/html; charset=utf-8');
        const entry=`/@fs/${root.replaceAll('\\','/')}/.local-preview/server-workspace-entry.jsx`;
        res.end(await dev.transformIndexHtml('/crm-sandbox',`<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NETWORTH — סנדבוקס שרת מקומי</title></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));return;
      }
      if (req.url === '/report-preview') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const entry = `/@fs/${root.replaceAll('\\', '/')}/.local-preview/report-history-preview.jsx`;
      res.end(await dev.transformIndexHtml('/report-preview', `<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NETWORTH CRM — סביבת פיתוח</title></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));
      } else if (files[req.url]) {
        try { res.setHeader('Content-Type', 'application/octet-stream'); res.end(await readFile(files[req.url])); }
        catch { res.statusCode = 404; res.end('Source not found'); }
      } else if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Live API disabled in preview'); }
      else next();
    });
  } }],
});
await server.listen();
console.log(`LOCAL_CRM_SANDBOX=http://127.0.0.1:${port}/crm-sandbox`);
