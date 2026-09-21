import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { auditSecrets, isPrivatePath } from '../audit-secrets.mjs';

const config = resolve('.gitleaks.toml');
const binary = process.env.GITLEAKS_BIN ?? 'gitleaks';
const hasScanner = spawnSync(binary, ['version'], { encoding: 'utf8' }).status === 0;
const scannerTest = (name, fn) => test(name, { skip: !hasScanner && 'Install Gitleaks to run scanner integration tests' }, fn);

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

async function write(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'openlinear-secret-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Secret Audit Fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  await write(root, '.gitignore', '.env\n.vercel/\n');
  await write(root, 'README.md', 'Synthetic test repository.\n');
  git(root, 'add', '.');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial fixture');
  return root;
}

test('identifies private artifacts without classifying the example environment as private', () => {
  for (const path of ['.env', 'apps/web/.env.production', '.vercel/project.json', 'outputs/review.json',
    'keys/service-account.json', 'service_account_dev.json', 'credentials.json', 'private.pem',
    'data/app.sqlite3-wal', 'data/app.db-journal', 'trace.har']) assert.equal(isPrivatePath(path), true, path);
  for (const path of ['.env.example', 'apps/web/.env.example', 'packages/hosted/src/personal-token-service.ts']) {
    assert.equal(isPrivatePath(path), false, path);
  }
});

scannerTest('allows specific evidence hashes and fixtures while excluding ignored local state', async (t) => {
  const root = await fixture(t);
  await write(root, '.env', `TOKEN=${'ghp_' + randomBytes(18).toString('hex')}\n`);
  await write(root, 'docs/product/versions/v0.2.0/review.json', JSON.stringify({ 'api.ts': randomBytes(32).toString('hex') }));
  const fixtureReference = 'tokref_' + '0123456789abcdef'.repeat(2);
  await write(root, 'packages/hosted/tests/fixture.test.ts', `const tokenReference = '${fixtureReference}';\n`);
  const report = await auditSecrets(root, { binary, config });
  assert.equal(report.status, 'PASS', JSON.stringify(report));
  assert.equal(report.commit_count, 1);
});

scannerTest('detects credentials removed from the current tree but still in history', async (t) => {
  const root = await fixture(t);
  const credential = 'ghp_' + randomBytes(18).toString('hex');
  await write(root, 'old.txt', `${credential}\n`);
  git(root, 'add', 'old.txt');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic history finding');
  git(root, 'rm', 'old.txt');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Remove synthetic finding');
  const report = await auditSecrets(root, { binary, config });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some((finding) => finding.scope === 'history'));
  assert.ok(!JSON.stringify(report).includes(credential), 'Reports must redact credentials');
});

scannerTest('limits the workflow fixture exception to its exact path and value', async (t) => {
  const root = await fixture(t);
  const path = 'packages/hosted/tests/workspace-configuration-service.test.ts';
  const fixtureId = ['integrity', 'defaults', 'key', '0001'].join('-');
  const synthetic = `const idempotencyKey = '${fixtureId}';\n`;
  await write(root, path, synthetic);
  assert.equal((await auditSecrets(root, {binary, config})).status, 'PASS');
  await write(root, 'packages/hosted/src/credential.ts', synthetic);
  let report = await auditSecrets(root, {binary, config});
  assert.ok(report.findings.some(finding => finding.path === 'packages/hosted/src/credential.ts'));
  const credential = randomBytes(32).toString('base64url');
  await write(root, path, `${synthetic}const api_key = '${credential}';\n`);
  report = await auditSecrets(root, {binary, config});
  assert.ok(report.findings.some(finding => finding.path === path && finding.rule === 'generic-api-key'));
  assert.ok(!JSON.stringify(report).includes(credential));
});

scannerTest('detects staged-only secrets and new untracked files, including tests and docs', async (t) => {
  const root = await fixture(t);
  const credential = 'ghp_' + randomBytes(18).toString('hex');
  await write(root, 'staged.txt', `${credential}\n`);
  git(root, 'add', 'staged.txt');
  await write(root, 'staged.txt', 'Credential removed from the working copy only.\n');
  const oauth = 'olm_at_' + randomBytes(32).toString('base64url');
  await write(root, 'packages/hosted/tests/new.test.ts', `const token = '${oauth}'; // gitleaks:allow\n`);
  await write(root, 'docs/product/versions/v0.2.0/review.json', JSON.stringify({ api_key: credential }));
  const report = await auditSecrets(root, { binary, config });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some((finding) => finding.scope === 'index' && finding.path === 'staged.txt'));
  assert.ok(report.findings.some((finding) => finding.scope === 'worktree' && finding.rule === 'openlinear-mcp-token'));
  assert.ok(report.findings.some((finding) => finding.path.endsWith('review.json')));
  assert.ok(!JSON.stringify(report).includes(credential));
  assert.ok(!JSON.stringify(report).includes(oauth));
});

scannerTest('fails for force-added private paths even if no credential pattern is present', async (t) => {
  const root = await fixture(t);
  await write(root, '.vercel/project.json', '{}\n');
  git(root, 'add', '-f', '.vercel/project.json');
  const report = await auditSecrets(root, { binary, config });
  assert.equal(report.status, 'FAIL');
  assert.deepEqual(report.private_paths, ['.vercel/project.json']);
});

scannerTest('rejects symlinks instead of silently skipping their contents', async (t) => {
  const root = await fixture(t);
  await symlink('README.md', join(root, 'linked.txt'));
  await assert.rejects(auditSecrets(root, { binary, config }), /non-regular file/u);
});
