import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only branding/PWA assets are public in a release. Local HTML demonstrations
// and insurer source inventories must not be copied by Vite into production.
export function productionPublicAssets() {
  const root = new URL('./public/', import.meta.url);
  return {
    name: 'production-public-assets',
    apply: 'build',
    buildStart() {
      const files = ['logo.png', 'icons.svg', 'favicon.svg', 'manifest.json', 'sw.js'];
      for (const directory of ['sandbox-brand', 'sandbox-insurers']) {
        for (const item of readdirSync(new URL(directory + '/', root), { withFileTypes: true })) {
          if (item.isFile() && /\.(png|svg)$/.test(item.name)) files.push(`${directory}/${item.name}`);
        }
      }
      for (const fileName of files) this.emitFile({ type: 'asset', fileName, source: readFileSync(fileURLToPath(new URL(fileName, root))) });
    },
  };
}
