#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPublicRelease } from './audit-public-release.mjs';

const root = process.cwd();
const assetPath = 'ops/release/asset-provenance.json';
const copyPath = 'ops/release/copy-provenance.json';

async function readExisting(candidateRoot, path) {
  try {
    return JSON.parse(await readFile(join(candidateRoot, path), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { entries: [] };
    throw error;
  }
}

function sourceReference(path) {
  const issue = /\/(CT-\d+)\//.exec(`/${path}`)?.[1];
  if (issue) return issue;
  const prototype = /^prototypes\/ct-(\d+)\//.exec(path)?.[1];
  return prototype ? `CT-${prototype}` : `project_source:${path}`;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validApprovedEntry(entry, record) {
  return entry?.path === record.path
    && entry.sha256 === record.sha256
    && entry.size === record.size
    && nonEmpty(entry.origin)
    && nonEmpty(entry.source_reference)
    && nonEmpty(entry.rights_basis)
    && entry.review_status === 'approved'
    && nonEmpty(entry.reviewer);
}

export function buildProvenanceEntry(existing, record, defaults) {
  const previous = existing.get(record.path);
  if (validApprovedEntry(previous, record)) return previous;
  return {
    path: record.path,
    sha256: record.sha256,
    size: record.size,
    ...defaults,
    reviewer: null,
    review_status: 'pending',
  };
}

function reviewState(entries) {
  const approved = entries.length > 0
    && entries.every((entry) => entry.review_status === 'approved' && nonEmpty(entry.reviewer));
  return {
    status: approved ? 'approved' : 'ready_for_accountable_review',
    review_status: approved ? 'approved' : 'pending',
  };
}

async function writeManifest(candidateRoot, path, value) {
  await mkdir(dirname(join(candidateRoot, path)), { recursive: true });
  await writeFile(join(candidateRoot, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function prepareReleaseProvenance(rootInput = root) {
  const candidateRoot = resolve(rootInput);
  const report = await auditPublicRelease(candidateRoot);
  const previousAssets = await readExisting(candidateRoot, assetPath);
  const previousCopy = await readExisting(candidateRoot, copyPath);
  const existingAssets = new Map((Array.isArray(previousAssets.entries) ? previousAssets.entries : [])
    .map((entry) => [entry.path, entry]));
  const existingCopy = new Map((Array.isArray(previousCopy.entries) ? previousCopy.entries : [])
    .map((entry) => [entry.path, entry]));

  const assetEntries = report.inventory.assets.map((record) => buildProvenanceEntry(existingAssets, record, {
    origin: record.path.startsWith('prototypes/')
      ? 'first_party_prototype_capture'
      : record.path.includes('/evidence/')
        ? 'first_party_application_capture'
        : 'first_party_project_asset',
    source_reference: sourceReference(record.path),
    rights_basis: 'First-party project artifact; accountable rights review remains pending.',
  }));
  const copyEntries = report.inventory.public_copy.map((record) => buildProvenanceEntry(existingCopy, record, {
    origin: 'independently_authored_project_source',
    source_reference: sourceReference(record.path),
    rights_basis: 'First-party project copy; accountable rights review remains pending.',
  }));

  await writeManifest(candidateRoot, assetPath, {
    schema_version: 'asset-provenance-v1',
    issue: 'CT-13',
    ...reviewState(assetEntries),
    source_set_sha256: report.source.sha256,
    entries: assetEntries,
  });
  await writeManifest(candidateRoot, copyPath, {
    schema_version: 'copy-provenance-v1',
    issue: 'CT-13',
    ...reviewState(copyEntries),
    source_set_sha256: report.source.sha256,
    entries: copyEntries,
  });

  return {
    assets: { path: assetPath, entries: assetEntries.length, pending: assetEntries.filter((entry) => entry.review_status !== 'approved').length },
    copy: { path: copyPath, entries: copyEntries.length, pending: copyEntries.filter((entry) => entry.review_status !== 'approved').length },
  };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await prepareReleaseProvenance(root), null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
