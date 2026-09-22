#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Git inventory failed (${args[0]}).`);
  return result.stdout;
}

function paths(output) {
  return [...new Set(output.split('\0').filter(Boolean))].sort();
}

export function isPrivatePath(path) {
  const name = basename(path);
  return /(^|\/)(?:\.control-tower|\.playwright-mcp|\.vercel|\.firebase|\.local-data|backups|outputs)(\/|$)/u.test(path)
    || (name !== '.env.example' && /^\.env(?:\.|$)/u.test(name))
    || /\.(?:pem|key|p12|pfx|jks|har|db|sqlite|sqlite3)(?:-.*)?$/iu.test(name)
    || /^(?:id_rsa|id_ed25519|credentials\.json|application_default_credentials\.json)$/u.test(name)
    || /(?:service[-_]account|firebase-adminsdk-).*\.json$/iu.test(name);
}

async function snapshot(root, destination, files) {
  const digest = createHash('sha256');
  let count = 0;
  for (const path of files) {
    const source = join(root, path);
    let stat;
    try { stat = await lstat(source); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!stat.isFile()) throw new Error(`Publication candidate contains a non-regular file: ${path}`);
    const target = join(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    const bytes = await readFile(target);
    digest.update(`${path}\0${createHash('sha256').update(bytes).digest('hex')}\n`);
    count += 1;
  }
  return { file_count: count, sha256: digest.digest('hex') };
}

export async function auditSecrets(rootInput = process.cwd(), options = {}) {
  const root = resolve(rootInput);
  const binary = options.binary ?? process.env.GITLEAKS_BIN ?? 'gitleaks';
  const config = resolve(options.config ?? join(root, '.gitleaks.toml'));
  const version = spawnSync(binary, ['version'], { encoding: 'utf8' });
  if (version.status !== 0) throw new Error('Install Gitleaks 8.30.1 or set GITLEAKS_BIN to its executable; see docs/operations/open-source-release.md.');
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
    throw new Error('Full history is required. Fetch with --unshallow before running this audit.');
  }
  const files = paths(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']));
  const indexed = paths(git(root, ['ls-files', '-z', '--stage']));
  for (const entry of indexed) {
    if (!/^100(?:644|755) [a-f0-9]+ 0\t/u.test(entry)) {
      throw new Error('Resolve index conflicts, symlinks, or submodules before auditing the publication candidate.');
    }
  }
  const historicalPaths = paths(git(root, ['log', '--all', '--format=', '--name-only', '-z', '--diff-filter=A']))
    .map((path) => path.replace(/^\n+/u, ''));
  const privatePaths = [...new Set([...files, ...historicalPaths].filter(isPrivatePath))].sort();
  const temporary = await mkdtemp(join(tmpdir(), 'basiclinear-secrets-'));
  const findings = [];
  const scans = [];
  try {
    const candidate = join(temporary, 'worktree');
    await mkdir(candidate);
    const worktree = await snapshot(root, candidate, files);
    const targets = [
      { scope: 'history', args: ['git', root, '--log-opts=--all --full-history -m'] },
      { scope: 'worktree', args: ['dir', candidate], prefix: `${candidate}/` },
    ];
    if (git(root, ['diff', '--cached', '--name-only', '-z']) !== '') {
      const index = join(temporary, 'index');
      await mkdir(index);
      git(root, ['checkout-index', '--all', `--prefix=${index}/`]);
      targets.push({ scope: 'index', args: ['dir', index], prefix: `${index}/` });
    }
    for (const target of targets) {
      const report = join(temporary, `${target.scope}.json`);
      const result = spawnSync(binary, [
        ...target.args, '--config', config, '--redact=100', '--no-banner', '--no-color',
        '--report-format=json', '--report-path', report,
        '--max-decode-depth=5', '--max-archive-depth=2',
        '--ignore-gitleaks-allow', '--gitleaks-ignore-path', join(temporary, '.gitleaksignore'),
      ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (![0, 1].includes(result.status)) throw new Error(`Gitleaks ${target.scope} scan failed; no clean result can be claimed.`);
      // Never expose Match, Secret, source lines, or raw scanner output.
      const detected = JSON.parse(await readFile(report, 'utf8'));
      if (!Array.isArray(detected) || (result.status === 1 && detected.length === 0)) {
        throw new Error(`Gitleaks ${target.scope} returned an incomplete result.`);
      }
      scans.push({ scope: target.scope, finding_count: detected.length });
      findings.push(...detected.map((finding) => ({
        scope: target.scope, rule: finding.RuleID,
        path: target.prefix && finding.File.startsWith(target.prefix)
          ? finding.File.slice(target.prefix.length) : finding.File,
        line: finding.StartLine, commit: finding.Commit || null,
      })));
    }
    return {
      schema_version: 'basiclinear-secret-audit-v1',
      status: findings.length === 0 && privatePaths.length === 0 ? 'PASS' : 'FAIL',
      scanner: `gitleaks ${version.stdout.trim()}`,
      head: git(root, ['rev-parse', 'HEAD']).trim(),
      commit_count: Number(git(root, ['rev-list', '--count', '--all']).trim()),
      worktree, scans, private_paths: privatePaths, findings,
      limitations: 'Scans reachable Git history, staged changes, and tracked/non-ignored working files. Ignored local state and image pixels are not certified. Pattern matching cannot prove absence of every possible secret.',
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--report')) {
    throw new Error('Usage: npm run audit:secrets -- [--report PATH]');
  }
  const report = await auditSecrets();
  if (args[0] === '--report') {
    const target = resolve(args[1]);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
