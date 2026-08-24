#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const lockPath = 'package-lock.json';
const noticePath = 'THIRD_PARTY_NOTICES.md';
const manifestPath = 'ops/release/third-party-notices.json';
const evidencePattern = /^(licen[cs]e|copying|copyright|notice)(\.|$)/i;

export const DISTRIBUTION_SCOPES = new Set([
  'runtime_dependency',
  'development_dependency',
  'optional_runtime_dependency',
  'optional_development_dependency',
  'peer_dependency',
  'optional_peer_dependency',
]);

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function packageName(lockPathValue, metadata) {
  if (metadata.name) return metadata.name;
  const marker = 'node_modules/';
  const index = lockPathValue.lastIndexOf(marker);
  return index === -1 ? basename(lockPathValue) : lockPathValue.slice(index + marker.length);
}

function cell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function classifyDistributionScope(metadata) {
  if (metadata.peer) return metadata.optional ? 'optional_peer_dependency' : 'peer_dependency';
  if (metadata.dev || metadata.devOptional) {
    return metadata.optional || metadata.devOptional
      ? 'optional_development_dependency'
      : 'development_dependency';
  }
  return metadata.optional ? 'optional_runtime_dependency' : 'runtime_dependency';
}

function evidenceStatus(installed, evidence) {
  if (!installed) return 'not_installed_on_inventory_host';
  return evidence.length > 0 ? 'local_license_or_notice' : 'declared_license_only';
}

async function readExisting(candidateRoot) {
  try {
    return JSON.parse(await readFile(join(candidateRoot, manifestPath), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function preservesApproval(existing, lockHash, noticeHash, technicallyComplete) {
  return technicallyComplete
    && existing?.status === 'approved'
    && existing?.review_status === 'approved'
    && typeof existing?.reviewer === 'string'
    && existing.reviewer.trim().length > 0
    && existing.lockfile_sha256 === lockHash
    && existing.notice_file_sha256 === noticeHash;
}

export async function prepareThirdPartyNotices(rootInput = root) {
  const candidateRoot = resolve(rootInput);
  const existing = await readExisting(candidateRoot);
  const lockBytes = await readFile(join(candidateRoot, lockPath));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const records = [];

  for (const [path, metadata] of Object.entries(lock.packages ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    if (!path.includes('node_modules/') || metadata.link) continue;
    const absolute = join(candidateRoot, path);
    const installed = await exists(absolute);
    const evidence = [];
    if (installed) {
      for (const entry of (await readdir(absolute, { withFileTypes: true }))
        .filter((item) => item.isFile() && evidencePattern.test(item.name))
        .sort((left, right) => left.name.localeCompare(right.name))) {
        const bytes = await readFile(join(absolute, entry.name));
        evidence.push({
          name: entry.name,
          kind: /^notice/i.test(entry.name) ? 'notice' : 'license',
          sha256: digest(bytes),
          size: bytes.length,
        });
      }
    }
    records.push({
      name: packageName(path, metadata),
      version: metadata.version ?? null,
      declared_license: metadata.license ?? null,
      lock_path: path,
      installed_on_inventory_host: installed,
      local_evidence: evidence,
      distribution_scope: classifyDistributionScope(metadata),
      evidence_status: evidenceStatus(installed, evidence),
    });
  }

  const lockHash = digest(lockBytes);
  const technicallyComplete = records.length > 0
    && records.every((record) => nonEmpty(record.version)
      && nonEmpty(record.declared_license)
      && DISTRIBUTION_SCOPES.has(record.distribution_scope));
  const lines = [
    '# Third-Party Notices',
    '',
    `Technical status: ${technicallyComplete ? 'COMPLETE' : 'INCOMPLETE'}; accountable review state is recorded in \`${manifestPath}\`.`,
    '',
    `Lockfile SHA-256: \`${lockHash}\``,
    '',
    'This inventory covers every third-party package record in the exact npm lockfile. Distribution scope is derived from locked npm metadata; local license and NOTICE evidence is hash-bound when installed. Accountable review remains a separate release gate.',
    '',
    '| Package | Version | Declared license | Distribution scope | Inventory evidence | Local license/NOTICE evidence |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const record of records) {
    const evidence = record.local_evidence.length === 0
      ? 'none'
      : record.local_evidence.map((item) => `${item.name} (${item.sha256})`).join('; ');
    lines.push(`| ${cell(record.name)} | ${cell(record.version ?? 'unknown')} | ${cell(record.declared_license ?? 'UNDECLARED')} | ${cell(record.distribution_scope)} | ${cell(record.evidence_status)} | ${cell(evidence)} |`);
  }
  const noticeBytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
  await writeFile(join(candidateRoot, noticePath), noticeBytes);
  const noticeHash = digest(noticeBytes);

  const counts = {
    records: records.length,
    installed_on_inventory_host: records.filter((record) => record.installed_on_inventory_host).length,
    absent_on_inventory_host: records.filter((record) => !record.installed_on_inventory_host).length,
    missing_declared_license: records.filter((record) => !record.declared_license).length,
    installed_without_local_license_or_notice: records.filter((record) => record.installed_on_inventory_host && record.local_evidence.length === 0).length,
    records_with_notice_file: records.filter((record) => record.local_evidence.some((item) => item.kind === 'notice')).length,
    distribution_scopes: Object.fromEntries([...DISTRIBUTION_SCOPES]
      .map((scope) => [scope, records.filter((record) => record.distribution_scope === scope).length])),
    evidence_statuses: Object.fromEntries(['local_license_or_notice', 'declared_license_only', 'not_installed_on_inventory_host']
      .map((status) => [status, records.filter((record) => record.evidence_status === status).length])),
  };
  const approvalPreserved = preservesApproval(existing, lockHash, noticeHash, technicallyComplete);
  const manifest = {
    schema_version: 'third-party-notices-v1',
    issue: 'CT-13',
    status: approvalPreserved
      ? 'approved'
      : technicallyComplete ? 'ready_for_accountable_review' : 'technical_evidence_incomplete',
    review_status: approvalPreserved ? 'approved' : 'pending',
    reviewer: approvalPreserved ? existing.reviewer : null,
    inventory_environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
    },
    lockfile_sha256: lockHash,
    notice_file: noticePath,
    notice_file_sha256: noticeHash,
    entries_sha256: digest(Buffer.from(JSON.stringify(records), 'utf8')),
    counts,
    entries: records,
  };
  await mkdir(dirname(join(candidateRoot, manifestPath)), { recursive: true });
  await writeFile(join(candidateRoot, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    noticePath,
    manifestPath,
    status: manifest.status,
    counts,
    lockfile_sha256: lockHash,
    notice_file_sha256: noticeHash,
  };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await prepareThirdPartyNotices(root), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
