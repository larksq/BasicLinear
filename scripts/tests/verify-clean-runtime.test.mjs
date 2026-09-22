import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { artifactManifest, parseArguments } from '../verify-clean-runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runner = join(root, 'scripts/verify-clean-runtime.mjs');
const guard = join(root, 'scripts/clean-runtime-network-guard.cjs');

test('requires explicit actor and session identities and separates independent acceptance', () => {
  assert.throws(() => parseArguments([]), /--actor is required/u);
  assert.throws(
    () => parseArguments(['--actor', 'tester', '--session', 'one']),
    /--implementation-actor is required/u,
  );
  assert.throws(
    () => parseArguments([
      '--actor', 'tester', '--session', 'one',
      '--implementation-actor', 'tester', '--implementation-session', 'zero',
    ]),
    /must differ from the implementation actor/u,
  );
  assert.deepEqual(
    parseArguments(['--actor', 'implementer', '--session', 'ct88', '--implementation-rehearsal']),
    {
      actor: 'implementer',
      session: 'ct88',
      implementationActor: '',
      implementationSession: '',
      output: null,
      keepWorkDirectory: false,
      implementationRehearsal: true,
      planOnly: false,
    },
  );
});

test('locks every built runtime surface and package input into one digest', () => {
  const manifest = artifactManifest(root);
  assert.match(manifest.digest, /^[a-f0-9]{64}$/u);
  assert.ok(manifest.bytes > 0);
  assert.ok(manifest.files.some((file) => file.path === 'apps/api/dist/index.js'));
  assert.ok(manifest.files.some((file) => file.path === 'apps/web/dist/index.html'));
  assert.ok(manifest.files.some((file) => file.path === 'ops/cli/dist/index.js'));
  assert.ok(manifest.files.some((file) => file.path === 'package-lock.json'));
});

test('preload denies and audits a real outbound fetch attempt', () => {
  const directory = mkdtempSync(join(tmpdir(), 'basiclinear-network-guard-test-'));
  try {
    const audit = join(directory, 'audit.jsonl');
    const result = spawnSync(process.execPath, [
      '--require', guard,
      '--eval',
      "fetch('https://example.com').then(() => { process.exitCode = 2; }).catch((error) => { if (error.code !== 'ERR_BASICLINEAR_OUTBOUND_DENIED') process.exitCode = 3; });",
    ], {
      cwd: root,
      env: { ...process.env, BASICLINEAR_NETWORK_AUDIT_PATH: audit },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const records = readFileSync(audit, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(records.filter((record) => record.event === 'outbound_denied').length, 1);
    assert.equal(records.find((record) => record.event === 'outbound_denied').operation, 'fetch');
    assert.equal(records.at(-1).event, 'guard_summary');
    assert.equal(records.at(-1).attempts, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('plan-only mode emits a non-accepting implementation preflight', () => {
  const result = spawnSync(process.execPath, [
    runner,
    '--actor', 'ct88-tooling',
    '--session', 'ct88-plan-test',
    '--implementation-rehearsal',
    '--plan-only',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.verdict, 'PLAN_READY');
  assert.equal(payload.independent, false);
  assert.match(payload.environment.source_revision, /^[a-f0-9]{40}$/u);
  assert.match(payload.artifact.sha256, /^[a-f0-9]{64}$/u);
});
