#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPublicRelease } from './audit-public-release.mjs';

const DEFAULT_POLICY = 'ops/release/audit-policy.json';

function commandOutput(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function prepareReleaseReview(rootInput = process.cwd(), options = {}) {
  const root = resolve(rootInput);
  const policy = options.policy ?? DEFAULT_POLICY;
  if (options.requireClean !== false) {
    const status = commandOutput('git', ['status', '--porcelain'], root);
    if (status === null) throw new Error('The candidate must be a Git worktree.');
    if (status !== '') throw new Error('The candidate worktree must be clean before preparing accountable review.');
  }

  const report = await auditPublicRelease(root, {
    policy,
    ...(options.revision ? { revision: options.revision } : {}),
  });
  const requestPath = options.write ?? report.review.request_manifest;
  if (requestPath !== report.review.request_manifest) {
    throw new Error(`The review request must be written to ${report.review.request_manifest}.`);
  }
  const output = `${JSON.stringify(report.review.expected_request, null, 2)}\n`;
  await mkdir(dirname(join(root, requestPath)), { recursive: true });
  await writeFile(join(root, requestPath), output, 'utf8');

  const validation = await auditPublicRelease(root, {
    policy,
    ...(options.revision ? { revision: options.revision } : {}),
  });
  const reviewCheck = validation.checks.find((check) => check.id === 'accountable_release_review');
  if (reviewCheck?.evidence?.request?.status !== 'valid') {
    throw new Error(`Generated review request failed validation: ${JSON.stringify(reviewCheck?.evidence?.request?.issues ?? [])}`);
  }
  return {
    schema_version: 'release-review-preparation-v1',
    issue: validation.issue,
    status: 'accountable_review_required',
    path: requestPath,
    sha256: sha256(await readFile(join(root, requestPath))),
    candidate: validation.source,
    acceptance_status: reviewCheck.evidence.acceptance.status,
  };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), policy: DEFAULT_POLICY, write: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') options.root = argv[++index];
    else if (argument === '--policy') options.policy = argv[++index];
    else if (argument === '--write') options.write = argv[++index];
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node scripts/prepare-release-review.mjs [--root PATH] [--policy PATH] [--write PATH]\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(await prepareReleaseReview(options.root, options), null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
