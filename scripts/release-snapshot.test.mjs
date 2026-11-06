import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {capture, verify} from './release-snapshot.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'networth-release-test-'));
  t.after(() => {
    // Only remove the unique directory created by this test, never the workspace or temp root.
    assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('networth-release-test-'));
    fs.rmSync(directory, {recursive: true, force: true});
  });
  const source = path.join(directory, 'input');
  fs.mkdirSync(source);
  const write = (relative, text = 'fixture') => {
    const filename = path.join(source, relative);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, text);
  };
  write('frontend/src/app.js', 'export const version = 1;');
  return {source, output: path.join(directory, 'snapshot'), label: 'test-1.0.0', profile: 'workspace', write};
}

test('captures source with verifiable hashes and refuses overwrite', t => {
  const f = fixture(t);
  const manifest = capture(f);
  assert.equal(verify(f.output).contentSha256, manifest.contentSha256);
  assert.equal(manifest.files.length, 1);
  assert.equal(fs.readFileSync(path.join(f.source, 'frontend/src/app.js'), 'utf8'), 'export const version = 1;');
  assert.throws(() => capture(f), /already exists/);
});

test('workspace allowlist excludes credentials, raw data, builds and archives', t => {
  const f = fixture(t);
  for (const name of ['backend/.env', 'backend/uploads/customer.pdf', '.staging-private/mail.eml', 'frontend/dist/index.js', 'frontend/sandbox-dist/index.js', '.release/old/backend/src/app.js', 'staging/credentials.json', 'staging/customer.json', 'tmp/customer.js']) f.write(name);
  assert.deepEqual(capture(f).files.map(file => file.path), ['frontend/src/app.js']);
});

test('allows workspace archive only in excluded versions folder', t => {
  const f = fixture(t);
  f.output = path.join(f.source, '.release', 'versions', f.label);
  assert.equal(capture(f).files.length, 1);
  assert.equal(verify(f.output).files, 1);
  assert.throws(() => capture({...f, output: path.join(f.source, 'frontend', 'backup')}), /Output must be outside/);
  assert.throws(() => capture({...f, output: f.source}), /Output cannot contain/);
});

test('tampered or missing files fail verification', t => {
  const f = fixture(t);
  capture(f);
  const filename = path.join(f.output, 'source', 'frontend/src/app.js');
  fs.writeFileSync(filename, 'changed');
  assert.throws(() => verify(f.output), /checksum mismatch/);
  fs.unlinkSync(filename);
  assert.throws(() => verify(f.output), /file set mismatch/);
});

test('extra files and changed manifest fail verification', t => {
  const f = fixture(t);
  capture(f);
  const filename = path.join(f.output, 'source', 'unexpected.txt');
  fs.writeFileSync(filename, 'extra');
  assert.throws(() => verify(f.output), /file set mismatch/);
  fs.unlinkSync(filename);
  const manifestPath = path.join(f.output, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files[0].size++;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verify(f.output), /Manifest checksum mismatch/);
});

test('historical profile rejects secrets before creating archive', t => {
  const f = fixture(t);
  f.write('backend/.env', 'fixture-not-a-secret');
  assert.throws(() => capture({...f, profile: 'historical-source'}), /forbidden/);
  assert.equal(fs.existsSync(f.output), false);
});

test('safe labels and manifest paths are mandatory', t => {
  const f = fixture(t);
  assert.throws(() => capture({...f, label: '../escape'}), /Invalid profile or label/);
  capture(f);
  const manifestPath = path.join(f.output, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files[0].path = '../escape';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verify(f.output), /Invalid manifest entries/);
});

test('historical source keeps its original package versions and bytes', t => {
  const f = fixture(t);
  f.write('frontend/package.json', '{"version":"0.0.0"}');
  capture({...f, profile: 'historical-source'});
  assert.equal(fs.readFileSync(path.join(f.output, 'source/frontend/package.json'), 'utf8'), '{"version":"0.0.0"}');
});
