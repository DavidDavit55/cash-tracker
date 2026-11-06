// Local source preservation only. No deployment, network, database or credential access.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validLabel = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value);
const safePath = value => typeof value === 'string' && value.length > 0 && !value.includes('\\') && !path.posix.isAbsolute(value) && !value.split('/').some(p => !p || p === '.' || p === '..' || /[:\x00-\x1f]/.test(p));
const denied = /(^|\/)(node_modules|dist|sandbox-dist|uploads|\.git|\.env[^/]*|\.gmail-private|\.sandbox-state|\.staging-private|\.release|\.staging-release)(\/|$)|(^|\/)(client_secret[^/]*|credentials[^/]*|token[^/]*|ACCESS\.txt)$/i;
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};

function allowed(relative, profile) {
  if (denied.test(relative)) return false;
  if (profile === 'historical-source') return true;
  if (['release.json', '.gitignore', 'AGENTS.md', 'SETUP.md'].includes(relative)) return true;
  if (/^(frontend|backend|staging)\/(package(-lock)?\.json|\.dockerignore)$/.test(relative)) return true;
  if (/^releases\/[^/]+\.json$/.test(relative) || /^docs\/.+\.md$/.test(relative)) return true;
  if (/^(frontend\/(src|public|sandbox)|backend\/src)\//.test(relative)) return /\.(jsx?|mjs|css|sql|html|svg|png|jpe?g|webp|woff2?|ttf)$/i.test(relative);
  if (/^(frontend|backend|staging|\.local-preview|scripts)\/[^/]+$/.test(relative)) return /\.(jsx?|mjs|cjs|css|sql|html|toml)$/.test(relative) || relative.endsWith('/Dockerfile');
  return false;
}

function inventory(directory, profile, prefix = '') {
  return fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!safePath(relative)) throw Error('Unsafe file path');
    if (profile === 'workspace' && denied.test(relative)) return [];
    if (entry.isSymbolicLink()) throw Error(`Links are not supported: ${relative}`);
    if (entry.isDirectory()) {
      if (profile === 'workspace' && !/^(frontend|backend|staging|\.local-preview|scripts|docs|releases)(\/|$)/.test(relative)) return [];
      return inventory(path.join(directory, entry.name), profile, relative);
    }
    if (!entry.isFile()) throw Error(`Unsupported file type: ${relative}`);
    return profile === 'workspace' && !allowed(relative, profile) ? [] : [relative];
  });
}

// Resolve existing parents too: a symlink must not redirect an archive into source files.
function canonicalTarget(target) {
  target = path.resolve(target);
  if (fs.existsSync(target)) return fs.realpathSync(target);
  return path.join(canonicalTarget(path.dirname(target)), path.basename(target));
}

export function capture({source, output, label, profile}) {
  if (!['workspace', 'historical-source'].includes(profile) || !validLabel(label)) throw Error('Invalid profile or label');
  source = fs.realpathSync(source);
  output = canonicalTarget(output);
  if (within(output, source)) throw Error('Output cannot contain the source');
  const archiveTarget = path.join(source, '.release', 'versions', label);
  if (within(source, output) && !(profile === 'workspace' && output === archiveTarget)) throw Error('Output must be outside source or in its excluded version archive');
  if (fs.existsSync(output)) throw Error('Snapshot already exists; never overwrite a previous version');
  const files = inventory(source, profile);
  if (!files.length || files.some(f => !allowed(f, profile))) throw Error('Empty source or forbidden files in source');
  const manifest = {
    schemaVersion: 1, label, profile, createdAt: new Date().toISOString(),
    notDeploymentArtifact: true,
    coverage: 'Selected source only. Not a backup of credentials, databases, uploads or customer documents. Local private archive; source may contain personal information.',
    files: [],
  };
  for (const relative of files) {
    const bytes = fs.readFileSync(path.join(source, relative));
    manifest.files.push({path: relative, size: bytes.length, sha256: digest(bytes)});
  }
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.mkdirSync(output); // Exclusive directory creation; never merge into an existing snapshot.
  for (const item of manifest.files) {
    const bytes = fs.readFileSync(path.join(source, item.path));
    if (bytes.length !== item.size || digest(bytes) !== item.sha256) throw Error(`Source changed during snapshot: ${item.path}`);
    const destination = path.join(output, 'source', item.path);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, bytes, {flag: 'wx'});
  }
  // Detect selected files added, removed or edited while copying. Incomplete snapshots have no manifest.
  if (JSON.stringify(inventory(source, profile)) !== JSON.stringify(files)) throw Error('Source file set changed during snapshot');
  for (const item of manifest.files) {
    if (digest(fs.readFileSync(path.join(source, item.path))) !== item.sha256) throw Error(`Source changed during snapshot: ${item.path}`);
  }
  manifest.contentSha256 = digest(JSON.stringify(manifest.files));
  fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {flag: 'wx'});
  verify(output);
  return manifest;
}

export function verify(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !validLabel(manifest.label) || !['workspace', 'historical-source'].includes(manifest.profile) || !Array.isArray(manifest.files) || !manifest.files.length) throw Error('Invalid manifest');
  if (manifest.files.some(f => !safePath(f.path) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256)) || new Set(manifest.files.map(f => f.path)).size !== manifest.files.length) throw Error('Invalid manifest entries');
  if (digest(JSON.stringify(manifest.files)) !== manifest.contentSha256) throw Error('Manifest checksum mismatch');
  const actual = inventory(path.join(directory, 'source'), 'verify').sort();
  const expected = manifest.files.map(f => f.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Snapshot file set mismatch');
  for (const item of manifest.files) {
    const bytes = fs.readFileSync(path.join(directory, 'source', item.path));
    if (bytes.length !== item.size || digest(bytes) !== item.sha256) throw Error(`Snapshot checksum mismatch: ${item.path}`);
  }
  return {label: manifest.label, files: manifest.files.length, contentSha256: manifest.contentSha256};
}

function cli(args) {
  const [command, ...rest] = args;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!['--label', '--source', '--profile'].includes(rest[i]) || !rest[i + 1] || options[rest[i]]) throw Error('Invalid arguments');
    options[rest[i]] = rest[i + 1];
  }
  const label = options['--label'];
  if (!validLabel(label)) throw Error('Specify a safe --label');
  const output = path.join(root, '.release', 'versions', label);
  if (command === 'verify') return verify(output);
  if (command !== 'capture') throw Error('Use capture or verify');
  const profile = options['--profile'] || 'workspace';
  if (profile === 'workspace' && options['--source']) throw Error('Workspace profile always uses this repository');
  const source = profile === 'workspace' ? root : fs.realpathSync(path.resolve(root, options['--source'] || ''));
  if (profile === 'historical-source' && (!within(path.join(root, '.release'), source) || source === path.join(root, '.release') || within(path.join(root, '.release', 'versions'), source))) throw Error('Historical source must be an existing prepared release under .release, not a version archive');
  const manifest = capture({source, output, label, profile});
  return {label, files: manifest.files.length, contentSha256: manifest.contentSha256, output};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(cli(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
