#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyDistributionScope,
  DISTRIBUTION_SCOPES,
} from './prepare-third-party-notices.mjs';

const DEFAULT_POLICY = 'ops/release/audit-policy.json';
const SUPPORTED_START_COMMAND = 'node apps/api/dist/index.js';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[a-f0-9]{7,64}$/u;
const REVIEW_REQUEST_SCHEMA = 'release-review-request-v1';
const REVIEW_ACCEPTANCE_SCHEMA = 'release-review-acceptance-v1';
const QUALIFIED_IDENTITY_REQUEST_SCHEMA = 'qualified-identity-review-request-v1';
const QUALIFIED_IDENTITY_ACCEPTANCE_SCHEMA = 'qualified-identity-review-acceptance-v1';
export const QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS = Object.freeze({
  license_compatibility: 'agpl_3_0_only_accepted',
  project_identity: 'scopefold_cleared',
  product_identity: 'openlinear_cleared',
  trademark_and_trade_dress: 'independent_expression_cleared',
  clean_room_method: 'restrictive_boundary_accepted',
  existing_reference_evidence: 'private_quarantine_accepted',
  public_comparative_claims: 'qualified_independent_evidence_only',
  contribution_intake: 'agpl_contribution_terms_accepted',
  asset_copy_and_notices: 'qualified_disposition_accepted',
});
export const REQUIRED_RELEASE_REVIEW_SCOPES = Object.freeze([
  'asset_provenance',
  'copy_provenance',
  'public_identity_and_clean_room',
  'public_release_candidate',
  'third_party_notices',
]);
const TEXT_EXTENSIONS = new Set([
  '', '.cjs', '.css', '.csv', '.env', '.html', '.ini', '.js', '.json', '.jsx',
  '.md', '.mjs', '.nginx', '.sh', '.sql', '.toml', '.ts', '.tsx', '.txt',
  '.yaml', '.yml',
]);

const SECRET_PATTERNS = [
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github_token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['openai_key', /\bsk-[A-Za-z0-9]{20,}\b/],
  ['slack_token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['google_api_key', /\bAIza[0-9A-Za-z_-]{20,}\b/],
];

function toPosix(path) {
  return path.split(sep).join('/');
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function walk(root, policy) {
  const files = [];
  const symlinks = [];
  const ignoredRoots = new Set(policy.ignored_roots);
  const ignoredNames = new Set(policy.ignored_file_names);
  const ignoredPaths = new Set(policy.ignored_paths ?? []);

  async function visit(directory, relativeDirectory = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = toPosix(join(relativeDirectory, entry.name));
      const pathSegments = relativePath.split('/');
      if (pathSegments.some((segment) => ignoredRoots.has(segment))
        || ignoredNames.has(entry.name)
        || ignoredPaths.has(relativePath)) continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        symlinks.push(relativePath);
      } else if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await visit(root);
  return { files, symlinks };
}

function isTextFile(path) {
  const extension = extname(path).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || path.endsWith('Dockerfile');
}

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

function check(id, status, summary, evidence = {}) {
  return { id, status, summary, evidence };
}

function acceptedDecision(result) {
  if (!result || result.completed !== true) return false;
  return ['accepted', 'complete', 'completed'].includes(String(result.status).toLowerCase());
}

async function inspectManifest(root, path) {
  const absolute = join(root, path);
  if (!await exists(absolute)) return { exists: false, path };
  try {
    return { exists: true, path, value: await readJson(absolute) };
  } catch (error) {
    return { exists: true, path, parse_error: error.message };
  }
}

function pathsUnder(files, roots) {
  return files.filter((path) => roots.some((root) => path === root || path.startsWith(`${root}/`)));
}

async function inspectIgnoreContract(root, contract) {
  const missing = [];
  for (const [path, requiredLines] of Object.entries(contract)) {
    const absolute = join(root, path);
    if (!await exists(absolute)) {
      missing.push({ path, line: null });
      continue;
    }
    const lines = new Set((await readFile(absolute, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')));
    for (const line of requiredLines) {
      if (!lines.has(line)) missing.push({ path, line });
    }
  }
  return missing;
}

async function inspectText(root, files, identityPatterns, identityFiles) {
  const identityFileSet = new Set(identityFiles);
  const identity = Object.fromEntries(identityPatterns.map((pattern) => [pattern, {
    occurrences: 0,
    files: [],
  }]));
  const secrets = [];

  for (const path of files.filter(isTextFile)) {
    const absolute = join(root, path);
    const stat = await lstat(absolute);
    if (stat.size > 2_000_000) continue;
    const content = await readFile(absolute, 'utf8');
    if (identityFileSet.has(path)) {
      for (const pattern of identityPatterns) {
        const occurrences = content.split(pattern).length - 1;
        if (occurrences > 0) {
          identity[pattern].occurrences += occurrences;
          identity[pattern].files.push(path);
        }
      }
    }
    for (const [kind, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) secrets.push({ path, kind });
    }
  }

  for (const result of Object.values(identity)) result.files.sort();
  return { identity, secrets };
}

async function inspectBuildManifest(root, manifest) {
  if (!manifest.exists || manifest.parse_error) {
    return { valid: false, mismatches: [{ path: manifest.path, reason: 'missing_or_invalid' }] };
  }
  const mismatches = [];
  const rootPackage = await readJson(join(root, 'package.json'));
  if (manifest.value.toolchain?.package_manager_declaration !== rootPackage.packageManager) {
    mismatches.push({ path: 'package.json', reason: 'package_manager_mismatch' });
  }
  for (const input of manifest.value.inputs ?? []) {
    const absolute = join(root, input.path);
    if (!await exists(absolute)) {
      mismatches.push({ path: input.path, reason: 'missing' });
    } else if (await sha256(absolute) !== input.sha256) {
      mismatches.push({ path: input.path, reason: 'sha256_mismatch' });
    }
  }
  if (manifest.value.runtime_topology !== 'single_node_loopback_sqlite') {
    mismatches.push({ path: manifest.path, reason: 'unsupported_runtime_topology' });
  }
  if (manifest.value.start_command !== SUPPORTED_START_COMMAND) {
    mismatches.push({ path: manifest.path, reason: 'unsupported_start_command' });
  }
  if (rootPackage.scripts?.start !== manifest.value.start_command) {
    mismatches.push({ path: 'package.json', reason: 'start_command_mismatch' });
  }
  if (Object.keys(rootPackage.scripts ?? {}).some((name) => name.startsWith('compose:'))) {
    mismatches.push({ path: 'package.json', reason: 'container_runtime_command_present' });
  }
  return { valid: mismatches.length === 0, mismatches };
}

async function inspectPackageLicenses(root) {
  const packagePaths = ['package.json'];
  for (const base of ['apps', 'packages']) {
    const basePath = join(root, base);
    if (!await exists(basePath)) continue;
    for (const entry of (await readdir(basePath, { withFileTypes: true }))
      .filter((item) => item.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const path = `${base}/${entry.name}/package.json`;
      if (await exists(join(root, path))) packagePaths.push(path);
    }
  }
  if (await exists(join(root, 'ops/cli/package.json'))) packagePaths.push('ops/cli/package.json');
  const missing = [];
  for (const path of packagePaths.sort()) {
    const pkg = await readJson(join(root, path));
    if (typeof pkg.license !== 'string' || pkg.license.trim() === '') missing.push(path);
  }
  return { package_paths: packagePaths.sort(), missing };
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function identifiedReviewValue(value) {
  return nonEmpty(value) && !/^REQUIRED(?:_|\s|$)/iu.test(value.trim());
}

async function artifactBinding(root, path) {
  const absolute = join(root, path);
  if (!await exists(absolute)) return { path, exists: false, sha256: null };
  return { path, exists: true, sha256: await sha256(absolute) };
}

function compareJson(expected, actual, path = 'request', issues = []) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      issues.push(`${path}:type`);
      return issues;
    }
    if (actual.length !== expected.length) issues.push(`${path}:length`);
    for (let index = 0; index < Math.min(expected.length, actual.length); index += 1) {
      compareJson(expected[index], actual[index], `${path}[${index}]`, issues);
    }
    return issues;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      issues.push(`${path}:type`);
      return issues;
    }
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    for (const key of expectedKeys) {
      if (!Object.hasOwn(actual, key)) issues.push(`${path}.${key}:missing`);
      else compareJson(expected[key], actual[key], `${path}.${key}`, issues);
    }
    for (const key of actualKeys) {
      if (!Object.hasOwn(expected, key)) issues.push(`${path}.${key}:unexpected`);
    }
    return issues;
  }
  if (actual !== expected) issues.push(`${path}:mismatch`);
  return issues;
}

function requestValidationIssues(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['request:type'];
  const revision = value.candidate?.source_revision;
  const issues = REVISION_PATTERN.test(revision ?? '') ? [] : ['request.candidate.source_revision:invalid'];
  const normalizedExpected = JSON.parse(JSON.stringify(expected));
  normalizedExpected.candidate.source_revision = revision;
  return compareJson(normalizedExpected, value, 'request', issues);
}

function validUtcTimestamp(value) {
  const shapeValid = nonEmpty(value)
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value);
  if (!shapeValid || Number.isNaN(Date.parse(value))) return false;
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  return new Date(value).toISOString() === normalized;
}

function reviewerValidationIssues(value, prefix = 'acceptance') {
  const issues = [];
  if (!value.reviewer || typeof value.reviewer !== 'object' || Array.isArray(value.reviewer)) {
    issues.push(`${prefix}.reviewer`);
  } else {
    for (const field of ['name', 'role', 'qualification']) {
      if (!identifiedReviewValue(value.reviewer[field])) issues.push(`${prefix}.reviewer.${field}`);
    }
  }
  if (!validUtcTimestamp(value.reviewed_at)) issues.push(`${prefix}.reviewed_at`);
  if (!Array.isArray(value.jurisdictions)
    || value.jurisdictions.length === 0
    || value.jurisdictions.some((entry) => !identifiedReviewValue(entry))
    || new Set(value.jurisdictions).size !== value.jurisdictions.length) {
    issues.push(`${prefix}.jurisdictions`);
  }
  return issues;
}

function acceptanceValidationIssues(value, requestValid, requestSha256, issue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['acceptance:type'];
  const issues = [];
  if (value.schema_version !== REVIEW_ACCEPTANCE_SCHEMA) issues.push('acceptance.schema_version');
  if (value.issue !== issue) issues.push('acceptance.issue');
  if (value.status !== 'accepted') issues.push('acceptance.status');
  issues.push(...reviewerValidationIssues(value));
  if (!requestValid) issues.push('acceptance.request_not_valid');
  if (!SHA256_PATTERN.test(value.request_sha256 ?? '') || value.request_sha256 !== requestSha256) {
    issues.push('acceptance.request_sha256');
  }
  if (JSON.stringify(value.accepted_scopes) !== JSON.stringify(REQUIRED_RELEASE_REVIEW_SCOPES)) {
    issues.push('acceptance.accepted_scopes');
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push('acceptance.notes');
  return issues;
}

function qualifiedIdentityAcceptanceInspection(value, requestValid, requestSha256, issue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { issues: ['acceptance:type'], accepted: false, remediation_required: false };
  }
  const issues = [];
  if (value.schema_version !== QUALIFIED_IDENTITY_ACCEPTANCE_SCHEMA) issues.push('acceptance.schema_version');
  if (value.issue !== issue) issues.push('acceptance.issue');
  if (!['accepted', 'remediation_required'].includes(value.status)) issues.push('acceptance.status');
  issues.push(...reviewerValidationIssues(value));
  if (!requestValid) issues.push('acceptance.request_not_valid');
  if (!SHA256_PATTERN.test(value.request_sha256 ?? '') || value.request_sha256 !== requestSha256) {
    issues.push('acceptance.request_sha256');
  }
  const dispositions = value.dispositions;
  const dispositionKeys = Object.keys(QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS).sort();
  if (!dispositions || typeof dispositions !== 'object' || Array.isArray(dispositions)) {
    issues.push('acceptance.dispositions');
  } else {
    const actualKeys = Object.keys(dispositions).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(dispositionKeys)) {
      issues.push('acceptance.dispositions:scope');
    }
    for (const key of dispositionKeys) {
      const acceptedValue = QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS[key];
      if (![acceptedValue, 'remediation_required'].includes(dispositions[key])) {
        issues.push(`acceptance.dispositions.${key}`);
      }
    }
  }
  const allAccepted = dispositionKeys.every(
    (key) => dispositions?.[key] === QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS[key],
  );
  if (value.status === 'accepted' && !allAccepted) issues.push('acceptance.dispositions:not_accepted');
  if (value.status === 'remediation_required' && allAccepted) issues.push('acceptance.dispositions:no_remediation');
  if (value.status === 'remediation_required' && !nonEmpty(value.remediation)) {
    issues.push('acceptance.remediation');
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push('acceptance.notes');
  return {
    issues,
    accepted: issues.length === 0 && value.status === 'accepted' && allAccepted,
    remediation_required: issues.length === 0 && value.status === 'remediation_required',
  };
}

function manifestCoverage(manifest, inventory, schemaVersion) {
  if (!manifest.exists || manifest.parse_error) {
    return {
      technical_complete: false,
      approved: false,
      missing: inventory.map((item) => item.path),
      stale: [],
      malformed: [manifest.parse_error ? `${manifest.path}:parse_error` : `${manifest.path}:missing`],
      unexpected: [],
      pending_review: [],
    };
  }
  const malformed = [];
  const rawEntries = Array.isArray(manifest.value.entries) ? manifest.value.entries : [];
  if (!Array.isArray(manifest.value.entries)) malformed.push(`${manifest.path}:entries`);
  if (manifest.value.schema_version !== schemaVersion) malformed.push(`${manifest.path}:schema_version`);
  if (!SHA256_PATTERN.test(manifest.value.source_set_sha256 ?? '')) malformed.push(`${manifest.path}:source_set_sha256`);
  const entries = new Map();
  for (const entry of rawEntries) {
    if (!nonEmpty(entry?.path)) {
      malformed.push(`${manifest.path}:entry_path`);
    } else if (entries.has(entry.path)) {
      malformed.push(`${entry.path}:duplicate`);
    } else {
      entries.set(entry.path, entry);
    }
  }
  const missing = [];
  const stale = [];
  const pendingReview = [];
  for (const item of inventory) {
    const entry = entries.get(item.path);
    if (!entry) {
      missing.push(item.path);
      continue;
    }
    if (entry.sha256 !== item.sha256 || entry.size !== item.size) {
      stale.push(item.path);
      continue;
    }
    const invalidFields = [
      ['origin', entry.origin],
      ['source_reference', entry.source_reference],
      ['rights_basis', entry.rights_basis],
    ].filter(([, value]) => !nonEmpty(value)).map(([field]) => field);
    if (invalidFields.length > 0) malformed.push(`${item.path}:${invalidFields.join(',')}`);
    if (entry.review_status === 'approved') {
      if (!nonEmpty(entry.reviewer)) malformed.push(`${item.path}:approved_without_reviewer`);
    } else if (entry.review_status === 'pending') {
      if (entry.reviewer !== null) malformed.push(`${item.path}:pending_with_reviewer`);
      else pendingReview.push(item.path);
    } else {
      malformed.push(`${item.path}:review_status`);
    }
  }
  const inventoryPaths = new Set(inventory.map((item) => item.path));
  const unexpected = [...entries.keys()].filter((path) => !inventoryPaths.has(path)).sort();
  const expectedStatus = pendingReview.length === 0 ? 'approved' : 'ready_for_accountable_review';
  const expectedReviewStatus = pendingReview.length === 0 ? 'approved' : 'pending';
  if (manifest.value.status !== expectedStatus) malformed.push(`${manifest.path}:status`);
  if (manifest.value.review_status !== expectedReviewStatus) malformed.push(`${manifest.path}:review_status`);
  const technicalComplete = missing.length === 0
    && stale.length === 0
    && malformed.length === 0
    && unexpected.length === 0;
  return {
    technical_complete: technicalComplete,
    approved: technicalComplete && pendingReview.length === 0,
    missing,
    stale,
    malformed,
    unexpected,
    pending_review: pendingReview,
  };
}

function noticeEntryValid(entry, expectedMetadata) {
  if (!entry || entry.version !== expectedMetadata.version || entry.declared_license !== expectedMetadata.license) return false;
  if (!nonEmpty(entry.name)
    || !nonEmpty(entry.version)
    || !nonEmpty(entry.declared_license)
    || !DISTRIBUTION_SCOPES.has(entry.distribution_scope)) return false;
  if (entry.distribution_scope !== classifyDistributionScope(expectedMetadata)) return false;
  if (typeof entry.installed_on_inventory_host !== 'boolean' || !Array.isArray(entry.local_evidence)) return false;
  if (entry.local_evidence.some((item) => !nonEmpty(item?.name)
    || !['license', 'notice'].includes(item.kind)
    || !SHA256_PATTERN.test(item.sha256 ?? '')
    || !Number.isInteger(item.size)
    || item.size < 1)) return false;
  const expectedEvidenceStatus = !entry.installed_on_inventory_host
    ? 'not_installed_on_inventory_host'
    : entry.local_evidence.length > 0 ? 'local_license_or_notice' : 'declared_license_only';
  return entry.evidence_status === expectedEvidenceStatus
    && (entry.installed_on_inventory_host || entry.local_evidence.length === 0);
}

async function inspectNotices(root, notices, manifest, lockHash, noticeHash) {
  const issues = [];
  if (!notices?.exists) issues.push('THIRD_PARTY_NOTICES.md:missing');
  if (!manifest.exists) issues.push(`${manifest.path}:missing`);
  if (manifest.parse_error) issues.push(`${manifest.path}:parse_error`);
  if (issues.length > 0) return { technical_complete: false, approved: false, issues };

  const value = manifest.value;
  const lock = await readJson(join(root, 'package-lock.json'));
  const expected = new Map(Object.entries(lock.packages ?? {})
    .filter(([path, metadata]) => path.includes('node_modules/') && !metadata.link));
  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  const entries = new Map();
  if (!Array.isArray(value.entries)) issues.push(`${manifest.path}:entries`);
  for (const entry of rawEntries) {
    if (!nonEmpty(entry?.lock_path)) issues.push(`${manifest.path}:entry_lock_path`);
    else if (entries.has(entry.lock_path)) issues.push(`${entry.lock_path}:duplicate`);
    else entries.set(entry.lock_path, entry);
  }
  for (const [path, metadata] of expected) {
    if (!entries.has(path)) issues.push(`${path}:missing`);
    else if (!noticeEntryValid(entries.get(path), metadata)) issues.push(`${path}:invalid`);
  }
  for (const path of entries.keys()) {
    if (!expected.has(path)) issues.push(`${path}:unexpected`);
  }
  if (value.schema_version !== 'third-party-notices-v1') issues.push(`${manifest.path}:schema_version`);
  if (value.lockfile_sha256 !== lockHash) issues.push(`${manifest.path}:lockfile_sha256`);
  if (value.notice_file !== notices.path) issues.push(`${manifest.path}:notice_file`);
  if (value.notice_file_sha256 !== noticeHash) issues.push(`${manifest.path}:notice_file_sha256`);
  if (value.entries_sha256 !== sha256Text(JSON.stringify(rawEntries))) issues.push(`${manifest.path}:entries_sha256`);
  if (value.counts?.records !== expected.size) issues.push(`${manifest.path}:record_count`);

  let approved = false;
  if (value.status === 'approved' && value.review_status === 'approved' && nonEmpty(value.reviewer)) {
    approved = true;
  } else if (value.status === 'ready_for_accountable_review'
    && value.review_status === 'pending'
    && value.reviewer === null) {
    approved = false;
  } else {
    issues.push(`${manifest.path}:review_state`);
  }
  return { technical_complete: issues.length === 0, approved: issues.length === 0 && approved, issues };
}

function evidenceStatus(coverage) {
  if (!coverage.technical_complete) return 'FAIL';
  return coverage.approved ? 'PASS' : 'BLOCKED';
}

async function buildExpectedQualifiedIdentityReviewRequest({
  root,
  policy,
  revision,
  decision,
  assetManifest,
  copyManifest,
  noticesManifest,
}) {
  const reviewPolicy = policy.qualified_identity_review;
  const evidence = await Promise.all(
    reviewPolicy.evidence_documents.map((path) => artifactBinding(root, path)),
  );
  return {
    schema_version: QUALIFIED_IDENTITY_REQUEST_SCHEMA,
    issue: 'CT-3',
    status: 'qualified_review_required',
    candidate: {
      source_revision: revision,
      evidence_set_sha256: sha256Text(JSON.stringify(evidence)),
    },
    sponsor_decision: {
      license: decision.value?.sponsor_decision?.license ?? null,
      project_identity: decision.value?.sponsor_decision?.project_identity ?? null,
      requested_final_product_brand: decision.value?.sponsor_decision?.requested_final_product_brand ?? null,
    },
    accepted_identity_patterns: reviewPolicy.accepted_identity_patterns ?? [],
    evidence,
    evidence_state: {
      asset_provenance: {
        status: assetManifest.value?.status ?? 'missing',
        review_status: assetManifest.value?.review_status ?? 'missing',
        records: Array.isArray(assetManifest.value?.entries) ? assetManifest.value.entries.length : 0,
      },
      copy_provenance: {
        status: copyManifest.value?.status ?? 'missing',
        review_status: copyManifest.value?.review_status ?? 'missing',
        records: Array.isArray(copyManifest.value?.entries) ? copyManifest.value.entries.length : 0,
      },
      third_party_notices: {
        status: noticesManifest.value?.status ?? 'missing',
        review_status: noticesManifest.value?.review_status ?? 'missing',
        records: noticesManifest.value?.counts?.records ?? 0,
      },
    },
    acceptance_contract: {
      schema_version: QUALIFIED_IDENTITY_ACCEPTANCE_SCHEMA,
      statuses: ['accepted', 'remediation_required'],
      required_reviewer_fields: ['name', 'role', 'qualification'],
      required_fields: ['reviewed_at', 'jurisdictions', 'request_sha256', 'dispositions'],
      accepted_dispositions: QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS,
      remediation_value: 'remediation_required',
    },
  };
}

async function buildExpectedReviewRequest({
  root,
  policy,
  policyPath,
  revision,
  sourceFileCount,
  sourceDigest,
  checks,
  decision,
  noticesManifest,
  noticesCoverage,
  assetManifest,
  assetCoverage,
  copyManifest,
  copyCoverage,
  qualifiedIdentityRequestPath,
  qualifiedIdentityAcceptancePath,
}) {
  const bind = (...paths) => Promise.all(paths.map((path) => artifactBinding(root, path)));
  return {
    schema_version: REVIEW_REQUEST_SCHEMA,
    issue: policy.issue,
    status: 'accountable_review_required',
    candidate: {
      source_revision: revision,
      source_file_count: sourceFileCount,
      source_sha256: sourceDigest,
    },
    scopes: [
      {
        id: 'asset_provenance',
        artifacts: await bind(assetManifest.path),
        state: {
          technical_complete: assetCoverage.technical_complete,
          manifest_status: assetManifest.value?.status ?? 'missing',
          review_status: assetManifest.value?.review_status ?? 'missing',
          records: Array.isArray(assetManifest.value?.entries) ? assetManifest.value.entries.length : 0,
        },
      },
      {
        id: 'copy_provenance',
        artifacts: await bind(copyManifest.path),
        state: {
          technical_complete: copyCoverage.technical_complete,
          manifest_status: copyManifest.value?.status ?? 'missing',
          review_status: copyManifest.value?.review_status ?? 'missing',
          records: Array.isArray(copyManifest.value?.entries) ? copyManifest.value.entries.length : 0,
        },
      },
      {
        id: 'public_identity_and_clean_room',
        artifacts: await bind(
          policy.decision_result,
          qualifiedIdentityRequestPath,
          qualifiedIdentityAcceptancePath,
        ),
        state: {
          decision_status: decision.value?.status ?? 'missing',
          completed: decision.value?.completed === true,
        },
      },
      {
        id: 'public_release_candidate',
        artifacts: await bind(
          policyPath,
          'LICENSE',
          'package.json',
          'package-lock.json',
          policy.dependency_inventory,
          policy.build_manifest,
          policy.testing_result,
        ),
        state: {
          checks: checks.map(({ id, status }) => ({ id, status })),
        },
      },
      {
        id: 'third_party_notices',
        artifacts: await bind('THIRD_PARTY_NOTICES.md', noticesManifest.path),
        state: {
          technical_complete: noticesCoverage.technical_complete,
          manifest_status: noticesManifest.value?.status ?? 'missing',
          review_status: noticesManifest.value?.review_status ?? 'missing',
          records: noticesManifest.value?.counts?.records ?? 0,
        },
      },
    ],
    acceptance_contract: {
      schema_version: REVIEW_ACCEPTANCE_SCHEMA,
      status: 'accepted',
      required_reviewer_fields: ['name', 'role', 'qualification'],
      required_fields: ['reviewed_at', 'jurisdictions', 'request_sha256', 'accepted_scopes'],
      required_scopes: REQUIRED_RELEASE_REVIEW_SCOPES,
    },
  };
}

export async function auditPublicRelease(rootInput, options = {}) {
  const root = resolve(rootInput);
  const policyPath = options.policy ?? DEFAULT_POLICY;
  const policy = await readJson(join(root, policyPath));
  const { files, symlinks } = await walk(root, policy);
  const sourceRecords = [];
  for (const path of files) {
    const absolute = join(root, path);
    const stat = await lstat(absolute);
    sourceRecords.push({ path, size: stat.size, sha256: await sha256(absolute) });
  }
  const digestExcludedPaths = new Set(policy.source_digest_exclusions ?? []);
  const sourceSetRecords = sourceRecords.filter((record) => !digestExcludedPaths.has(record.path));
  const sourceDigest = sha256Text(sourceSetRecords
    .map((record) => `${record.path}\0${record.sha256}`)
    .join('\n'));
  const assets = sourceRecords.filter((record) => policy.asset_extensions.includes(extname(record.path).toLowerCase()));
  const copyPaths = pathsUnder(files, policy.public_copy_roots).filter(isTextFile);
  const publicCopy = sourceRecords.filter((record) => copyPaths.includes(record.path));
  const identityFiles = pathsUnder(files, policy.identity_scan_roots);
  const { identity, secrets } = await inspectText(
    root,
    files,
    policy.working_identity_patterns,
    identityFiles,
  );
  const identityOccurrences = Object.values(identity)
    .reduce((total, value) => total + value.occurrences, 0);
  const acceptedIdentityPatterns = new Set(
    policy.qualified_identity_review?.accepted_identity_patterns ?? [],
  );
  const unresolvedIdentityPatterns = Object.entries(identity)
    .filter(([pattern, value]) => value.occurrences > 0 && !acceptedIdentityPatterns.has(pattern))
    .map(([pattern]) => pattern);

  const decision = await inspectManifest(root, policy.decision_result);
  const dependencyInventory = await inspectManifest(root, policy.dependency_inventory);
  const testing = await inspectManifest(root, policy.testing_result);
  const buildManifest = await inspectManifest(root, policy.build_manifest);
  const noticesManifest = await inspectManifest(root, policy.third_party_notices_manifest);
  const [assetManifestPath, copyManifestPath, reviewManifestPath] = policy.required_manifests;
  const reviewRequestManifestPath = policy.review_request_manifest ?? 'ops/release/review-request.json';
  const qualifiedIdentityReviewPolicy = policy.qualified_identity_review ?? {
    request_manifest: 'ops/release/qualified-identity-review-request.json',
    acceptance_manifest: 'ops/release/qualified-identity-review-acceptance.json',
    evidence_documents: [policy.decision_result],
  };
  const assetManifest = await inspectManifest(root, assetManifestPath);
  const copyManifest = await inspectManifest(root, copyManifestPath);
  const reviewRequestManifest = await inspectManifest(root, reviewRequestManifestPath);
  const reviewManifest = await inspectManifest(root, reviewManifestPath);
  const qualifiedIdentityRequestManifest = await inspectManifest(
    root,
    qualifiedIdentityReviewPolicy.request_manifest,
  );
  const qualifiedIdentityAcceptanceManifest = await inspectManifest(
    root,
    qualifiedIdentityReviewPolicy.acceptance_manifest,
  );
  const packageLicenses = await inspectPackageLicenses(root);
  const ignoreMissing = await inspectIgnoreContract(root, policy.ignore_contract);
  const build = await inspectBuildManifest(root, buildManifest);
  const assetCoverage = manifestCoverage(assetManifest, assets, 'asset-provenance-v1');
  const copyCoverage = manifestCoverage(copyManifest, publicCopy, 'copy-provenance-v1');
  const lockHash = await sha256(join(root, 'package-lock.json'));
  const dependencyInventoryValid = dependencyInventory.exists
    && !dependencyInventory.parse_error
    && dependencyInventory.value.source?.sha256 === lockHash
    && dependencyInventory.value.counts?.third_party_package_records > 0
    && dependencyInventory.value.project_metadata?.workspace_license_undeclared_count >= 0;

  const revision = options.revision ?? commandOutput('git', ['rev-parse', '--verify', 'HEAD'], root);
  const gitStatus = commandOutput('git', ['status', '--porcelain'], root);
  const untrackedCount = gitStatus === null ? null : gitStatus.split(/\r?\n/)
    .filter((line) => line.startsWith('??')).length;
  const privateArtifacts = files.filter((path) => {
    const lower = path.toLowerCase();
    if (lower === '.env.example') return false;
    return lower === '.env' || lower.startsWith('.env.')
      || policy.private_file_suffixes.some((suffix) => lower.endsWith(suffix));
  });
  const requiredDocs = await Promise.all(policy.required_public_documents.map(async (path) => ({
    path,
    exists: await exists(join(root, path)),
  })));
  const notices = requiredDocs.find((item) => item.path === 'THIRD_PARTY_NOTICES.md');
  const contributionDocs = requiredDocs.filter((item) => ['CONTRIBUTING.md', 'SECURITY.md'].includes(item.path));

  const expectedQualifiedIdentityRequest = await buildExpectedQualifiedIdentityReviewRequest({
    root,
    policy: { ...policy, qualified_identity_review: qualifiedIdentityReviewPolicy },
    revision,
    decision,
    assetManifest,
    copyManifest,
    noticesManifest,
  });
  const qualifiedIdentityRequestSha256 = qualifiedIdentityRequestManifest.exists
    ? await sha256(join(root, qualifiedIdentityRequestManifest.path))
    : null;
  const qualifiedIdentityRequestIssues = !qualifiedIdentityRequestManifest.exists
    ? [`${qualifiedIdentityRequestManifest.path}:missing`]
    : qualifiedIdentityRequestManifest.parse_error
      ? [`${qualifiedIdentityRequestManifest.path}:parse_error`]
      : requestValidationIssues(qualifiedIdentityRequestManifest.value, expectedQualifiedIdentityRequest);
  for (const artifact of expectedQualifiedIdentityRequest.evidence) {
    if (!artifact.exists) qualifiedIdentityRequestIssues.push(`request.evidence.${artifact.path}:missing`);
  }
  for (const [key, expected] of Object.entries(
    qualifiedIdentityReviewPolicy.required_sponsor_decision ?? {},
  )) {
    if (expectedQualifiedIdentityRequest.sponsor_decision[key] !== expected) {
      qualifiedIdentityRequestIssues.push(`request.sponsor_decision.${key}:unexpected`);
    }
  }
  if (qualifiedIdentityRequestManifest.value?.candidate?.source_revision
    && gitStatus !== null
    && commandOutput(
      'git',
      ['cat-file', '-t', qualifiedIdentityRequestManifest.value.candidate.source_revision],
      root,
    ) !== 'commit') {
    qualifiedIdentityRequestIssues.push('request.candidate.source_revision:unknown');
  }
  const qualifiedIdentityRequestValid = qualifiedIdentityRequestIssues.length === 0;
  const qualifiedIdentityAcceptance = !qualifiedIdentityAcceptanceManifest.exists
    ? { issues: [], accepted: false, remediation_required: false }
    : qualifiedIdentityAcceptanceManifest.parse_error
      ? {
        issues: [`${qualifiedIdentityAcceptanceManifest.path}:parse_error`],
        accepted: false,
        remediation_required: false,
      }
      : qualifiedIdentityAcceptanceInspection(
        qualifiedIdentityAcceptanceManifest.value,
        qualifiedIdentityRequestValid,
        qualifiedIdentityRequestSha256,
        'CT-3',
      );
  const decisionResultAccepted = acceptedDecision(decision.value);
  const identityDecisionStatus = !qualifiedIdentityRequestValid
    ? 'FAIL'
    : !qualifiedIdentityAcceptanceManifest.exists
      ? 'BLOCKED'
      : qualifiedIdentityAcceptance.issues.length > 0
        ? 'FAIL'
        : qualifiedIdentityAcceptance.remediation_required
          ? 'FAIL'
          : !decisionResultAccepted ? 'BLOCKED' : 'PASS';
  const decisionAccepted = identityDecisionStatus === 'PASS';
  const identityDecisionSummary = decisionAccepted
    ? 'The CT-3 decision and exact qualified-review acceptance are complete.'
    : !qualifiedIdentityRequestValid
      ? 'The CT-3 qualified-review request is missing, stale, or malformed.'
      : !qualifiedIdentityAcceptanceManifest.exists
        ? 'The exact CT-3 qualified-review request is ready, but acceptance is absent.'
        : qualifiedIdentityAcceptance.remediation_required
          ? 'The qualified CT-3 review requires remediation before release.'
          : qualifiedIdentityAcceptance.issues.length > 0
            ? 'The CT-3 qualified-review acceptance is stale, malformed, or incomplete.'
            : 'The qualified CT-3 acceptance exists, but the decision result is not reconciled.';

  const checks = [];
  checks.push(check(
    'source_revision',
    revision ? 'PASS' : 'BLOCKED',
    revision ? 'A source revision identifies the candidate.' : 'The repository has no source revision.',
    { revision, untracked_count: untrackedCount },
  ));
  checks.push(check(
    'public_identity_decision',
    identityDecisionStatus,
    identityDecisionSummary,
    {
      result: policy.decision_result,
      status: decision.value?.status ?? 'missing',
      completed: decision.value?.completed ?? false,
      qualified_review: {
        request: {
          manifest: qualifiedIdentityRequestManifest.path,
          status: qualifiedIdentityRequestValid
            ? 'valid'
            : qualifiedIdentityRequestManifest.exists ? 'invalid' : 'missing',
          sha256: qualifiedIdentityRequestSha256,
          issues: qualifiedIdentityRequestIssues,
        },
        acceptance: {
          manifest: qualifiedIdentityAcceptanceManifest.path,
          status: qualifiedIdentityAcceptance.accepted
            ? 'accepted'
            : qualifiedIdentityAcceptance.remediation_required
              ? 'remediation_required'
              : qualifiedIdentityAcceptanceManifest.exists ? 'invalid' : 'missing',
          reviewer: qualifiedIdentityAcceptanceManifest.value?.reviewer ?? null,
          reviewed_at: qualifiedIdentityAcceptanceManifest.value?.reviewed_at ?? null,
          issues: qualifiedIdentityAcceptance.issues,
        },
      },
    },
  ));
  checks.push(check(
    'working_codename_removal',
    identityOccurrences === 0 || (decisionAccepted && unresolvedIdentityPatterns.length === 0)
      ? 'PASS'
      : decisionAccepted ? 'FAIL' : 'BLOCKED',
    identityOccurrences === 0
      ? 'No unresolved working-identity references remain.'
      : decisionAccepted && unresolvedIdentityPatterns.length === 0
        ? 'The remaining identity references match the qualified and reconciled public identity.'
        : 'Working-identity references remain pending qualified identity review.',
    {
      occurrences: identityOccurrences,
      patterns: identity,
      accepted_identity_patterns: [...acceptedIdentityPatterns],
      unresolved_patterns: unresolvedIdentityPatterns,
      accepted_as_public_identity: decisionAccepted && unresolvedIdentityPatterns.length === 0,
    },
  ));
  const licenseExists = requiredDocs.find((item) => item.path === 'LICENSE')?.exists === true;
  checks.push(check(
    'project_license',
    licenseExists && packageLicenses.missing.length === 0 ? 'PASS' : decisionAccepted ? 'FAIL' : 'BLOCKED',
    licenseExists && packageLicenses.missing.length === 0
      ? 'The root and workspace packages declare the accepted license.'
      : 'The root license or package license metadata is absent.',
    { root_license: licenseExists, package_manifests: packageLicenses.package_paths.length, missing_package_license: packageLicenses.missing },
  ));
  checks.push(check(
    'dependency_metadata_inventory',
    dependencyInventoryValid ? 'PASS' : 'FAIL',
    dependencyInventoryValid ? 'The dependency metadata inventory matches the lockfile.' : 'The dependency metadata inventory is missing or stale.',
    { inventory: policy.dependency_inventory, lock_sha256: lockHash },
  ));
  const noticesHash = notices?.exists ? await sha256(join(root, notices.path)) : null;
  const noticesCoverage = await inspectNotices(root, notices, noticesManifest, lockHash, noticesHash);
  checks.push(check(
    'third_party_notices',
    evidenceStatus(noticesCoverage),
    noticesCoverage.approved
      ? 'The dependency notices are technically complete, hash-bound, and approved.'
      : noticesCoverage.technical_complete
        ? 'The dependency notices are technically complete and await accountable review.'
        : 'The dependency notice evidence is missing, stale, malformed, or unclassified.',
    {
      path: notices?.path ?? 'THIRD_PARTY_NOTICES.md',
      manifest: noticesManifest.path,
      status: noticesManifest.value?.status ?? 'missing',
      counts: noticesManifest.value?.counts ?? null,
      technical_complete: noticesCoverage.technical_complete,
      approved: noticesCoverage.approved,
      issues: noticesCoverage.issues,
    },
  ));
  checks.push(check(
    'private_path_controls',
    ignoreMissing.length === 0 ? 'PASS' : 'FAIL',
    ignoreMissing.length === 0 ? 'Private state and credential paths are excluded by the source ignore policy.' : 'A required private-path exclusion is missing.',
    { missing: ignoreMissing },
  ));
  checks.push(check(
    'private_artifact_scan',
    privateArtifacts.length === 0 && secrets.length === 0 ? 'PASS' : 'FAIL',
    privateArtifacts.length === 0 && secrets.length === 0 ? 'No private artifact or high-confidence secret indicator was found.' : 'The candidate contains a private artifact or secret indicator.',
    { private_artifacts: privateArtifacts, secret_indicators: secrets, symlinks },
  ));
  checks.push(check(
    'asset_provenance',
    evidenceStatus(assetCoverage),
    assetCoverage.approved
      ? 'Every binary asset has approved, hash-bound provenance.'
      : assetCoverage.technical_complete
        ? 'Every binary asset has complete, hash-bound provenance awaiting accountable review.'
        : 'Binary asset provenance is missing, stale, or malformed.',
    { manifest: assetManifest.path, asset_count: assets.length, ...assetCoverage },
  ));
  checks.push(check(
    'copy_provenance',
    evidenceStatus(copyCoverage),
    copyCoverage.approved
      ? 'Every public-copy file has approved, hash-bound provenance.'
      : copyCoverage.technical_complete
        ? 'Every public-copy file has complete, hash-bound provenance awaiting accountable review.'
        : 'Public-copy provenance is missing, stale, or malformed.',
    { manifest: copyManifest.path, copy_file_count: publicCopy.length, ...copyCoverage },
  ));
  checks.push(check(
    'contribution_and_security_policy',
    contributionDocs.every((item) => item.exists) ? 'PASS' : 'FAIL',
    contributionDocs.every((item) => item.exists) ? 'Contribution and private vulnerability-reporting policies exist.' : 'Contribution or security policy is missing.',
    { documents: contributionDocs },
  ));
  checks.push(check(
    'reproducible_build_inputs',
    build.valid ? 'PASS' : 'FAIL',
    build.valid ? 'The local runtime build inputs and topology are hash-pinned.' : 'The local-runtime build manifest is missing, stale, or unsupported.',
    { manifest: buildManifest.path, status: buildManifest.value?.status ?? 'missing', mismatches: build.mismatches },
  ));
  const cleanHostPassed = testing.value?.planned_tests?.['P-T21'] === 'passed';
  checks.push(check(
    'clean_host_network_denied_runtime',
    cleanHostPassed ? 'PASS' : 'BLOCKED',
    cleanHostPassed ? 'The clean-host network-denied runtime check passed.' : 'P-T21 is not yet passed on an independent clean host.',
    { result: policy.testing_result, observed: testing.value?.planned_tests?.['P-T21'] ?? 'missing' },
  ));

  const expectedReviewRequest = await buildExpectedReviewRequest({
    root,
    policy,
    policyPath,
    revision,
    sourceFileCount: sourceSetRecords.length,
    sourceDigest,
    checks,
    decision,
    noticesManifest,
    noticesCoverage,
    assetManifest,
    assetCoverage,
    copyManifest,
    copyCoverage,
    qualifiedIdentityRequestPath: qualifiedIdentityRequestManifest.path,
    qualifiedIdentityAcceptancePath: qualifiedIdentityAcceptanceManifest.path,
  });
  const reviewRequestSha256 = reviewRequestManifest.exists
    ? await sha256(join(root, reviewRequestManifest.path))
    : null;
  const reviewRequestIssues = !reviewRequestManifest.exists
    ? [`${reviewRequestManifest.path}:missing`]
    : reviewRequestManifest.parse_error
      ? [`${reviewRequestManifest.path}:parse_error`]
      : requestValidationIssues(reviewRequestManifest.value, expectedReviewRequest);
  if (reviewRequestManifest.value?.candidate?.source_revision
    && gitStatus !== null
    && commandOutput(
      'git',
      ['cat-file', '-t', reviewRequestManifest.value.candidate.source_revision],
      root,
    ) !== 'commit') {
    reviewRequestIssues.push('request.candidate.source_revision:unknown');
  }
  const reviewRequestValid = reviewRequestIssues.length === 0;
  const acceptanceIssues = !reviewManifest.exists
    ? []
    : reviewManifest.parse_error
      ? [`${reviewManifest.path}:parse_error`]
      : acceptanceValidationIssues(
        reviewManifest.value,
        reviewRequestValid,
        reviewRequestSha256,
        policy.issue,
      );
  const reviewAccepted = reviewManifest.exists
    && !reviewManifest.parse_error
    && acceptanceIssues.length === 0;
  const accountableStatus = !reviewRequestValid
    ? 'FAIL'
    : !reviewManifest.exists
      ? 'BLOCKED'
      : reviewAccepted ? 'PASS' : 'FAIL';
  const accountableSummary = reviewAccepted
    ? 'The accountable CT-13 reviewer accepted the exact current review request.'
    : !reviewRequestValid
      ? 'The accountable review request is missing, stale, or malformed.'
      : !reviewManifest.exists
        ? 'The exact review request is ready, but accountable CT-13 acceptance is absent.'
        : 'The accountable CT-13 acceptance is stale, malformed, or incomplete.';
  checks.push(check(
    'accountable_release_review',
    accountableStatus,
    accountableSummary,
    {
      request: {
        manifest: reviewRequestManifest.path,
        status: reviewRequestValid ? 'valid' : reviewRequestManifest.exists ? 'invalid' : 'missing',
        sha256: reviewRequestSha256,
        issues: reviewRequestIssues,
      },
      acceptance: {
        manifest: reviewManifest.path,
        status: reviewAccepted ? 'accepted' : reviewManifest.exists ? 'invalid' : 'missing',
        reviewer: reviewManifest.value?.reviewer ?? null,
        reviewed_at: reviewManifest.value?.reviewed_at ?? null,
        issues: acceptanceIssues,
      },
    },
  ));

  const summary = {
    pass: checks.filter((item) => item.status === 'PASS').length,
    fail: checks.filter((item) => item.status === 'FAIL').length,
    blocked: checks.filter((item) => item.status === 'BLOCKED').length,
  };
  const ready = summary.fail === 0 && summary.blocked === 0;
  return {
    schema_version: 'public-release-audit-v1',
    issue: policy.issue,
    test: policy.test,
    verdict: ready ? 'READY' : 'NOT_READY',
    source: {
      revision,
      file_count: sourceSetRecords.length,
      sha256: sourceDigest,
    },
    inventory: {
      assets,
      public_copy: publicCopy,
    },
    review: {
      request_manifest: reviewRequestManifest.path,
      acceptance_manifest: reviewManifest.path,
      expected_request: expectedReviewRequest,
    },
    identity_review: {
      request_manifest: qualifiedIdentityRequestManifest.path,
      acceptance_manifest: qualifiedIdentityAcceptanceManifest.path,
      expected_request: expectedQualifiedIdentityRequest,
    },
    summary,
    checks,
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
    process.stdout.write('Usage: node scripts/audit-public-release.mjs [--root PATH] [--policy PATH] [--write PATH]\n');
    return;
  }
  const report = await auditPublicRelease(options.root, { policy: options.policy });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.write) {
    const target = resolve(options.root, options.write);
    await writeFile(target, output, 'utf8');
  }
  process.stdout.write(output);
  if (report.verdict !== 'READY') process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 2;
  });
}
