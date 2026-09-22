#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
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
    if (error && error.code === 'ENOENT') return false;
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

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function check(id, status, summary, evidence = {}) {
  return { id, status, summary, evidence };
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

function isTextFile(path) {
  const extension = extname(path).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || path.endsWith('Dockerfile');
}

function pathInRoots(path, roots) {
  return roots.some((root) => root === '.'
    || path === root
    || path.startsWith(root.endsWith('/') ? root : root + '/'));
}

function pathExcluded(path, exclusions) {
  return exclusions.some((exclusion) => path === exclusion
    || path.startsWith(exclusion.endsWith('/') ? exclusion : exclusion + '/'));
}

async function walk(root, policy) {
  const files = [];
  const symlinks = [];
  const ignoredRoots = new Set(policy.ignored_roots ?? []);
  const ignoredNames = new Set(policy.ignored_file_names ?? []);
  const ignoredPaths = new Set(policy.ignored_paths ?? []);

  async function visit(directory, relativeDirectory = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = toPosix(join(relativeDirectory, entry.name));
      if (relativePath.split('/').some((segment) => ignoredRoots.has(segment))
        || ignoredNames.has(entry.name)
        || ignoredPaths.has(relativePath)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        symlinks.push(relativePath);
      } else if (entry.isDirectory()) {
        await visit(absolute, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await visit(root);
  return { files, symlinks };
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

async function inspectIgnoreContract(root, contract = {}) {
  const missing = [];
  for (const [path, requiredLines] of Object.entries(contract)) {
    const absolute = join(root, path);
    if (!await exists(absolute)) {
      missing.push({ path, line: null });
      continue;
    }
    const lines = new Set((await readFile(absolute, 'utf8'))
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')));
    for (const line of requiredLines) {
      if (!lines.has(line)) missing.push({ path, line });
    }
  }
  return missing;
}

async function inspectLegacyIdentity(root, files, policy) {
  const patterns = policy.legacy_identity_patterns ?? [];
  const scanRoots = policy.identity_scan_roots ?? [];
  const excluded = policy.identity_scan_exclusions ?? [];
  const results = Object.fromEntries(patterns.map((pattern) => [pattern, {
    occurrences: 0,
    files: [],
  }]));
  const secrets = [];

  for (const path of files) {
    if (!isTextFile(path) || !pathInRoots(path, scanRoots) || pathExcluded(path, excluded)) continue;
    const absolute = join(root, path);
    const stat = await lstat(absolute);
    if (stat.size > 2_000_000) continue;
    const content = await readFile(absolute, 'utf8');
    for (const pattern of patterns) {
      const occurrences = content.split(pattern).length - 1;
      if (occurrences > 0) {
        results[pattern].occurrences += occurrences;
        results[pattern].files.push(path);
      }
    }
    for (const [kind, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) secrets.push({ path, kind });
    }
  }

  for (const result of Object.values(results)) result.files.sort();
  return { results, secrets };
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
      const path = base + '/' + entry.name + '/package.json';
      if (await exists(join(root, path))) packagePaths.push(path);
    }
  }
  if (await exists(join(root, 'ops/cli/package.json'))) packagePaths.push('ops/cli/package.json');
  const missing = [];
  for (const path of packagePaths.sort()) {
    const pkg = await readJson(join(root, path));
    if (!nonEmpty(pkg.license)) missing.push(path);
  }
  return { package_paths: packagePaths.sort(), missing };
}

function provenanceCoverage(manifest, inventory, schemaVersion, sourceDigest) {
  if (!manifest.exists || manifest.parse_error) {
    return {
      complete: false,
      missing: inventory.map((item) => item.path),
      stale: [],
      malformed: [manifest.parse_error ? manifest.path + ':parse_error' : manifest.path + ':missing'],
      unexpected: [],
    };
  }
  const malformed = [];
  const rawEntries = Array.isArray(manifest.value.entries) ? manifest.value.entries : [];
  if (!Array.isArray(manifest.value.entries)) malformed.push(manifest.path + ':entries');
  if (manifest.value.schema_version !== schemaVersion) malformed.push(manifest.path + ':schema_version');
  if (manifest.value.status !== 'complete') malformed.push(manifest.path + ':status');
  if (Object.hasOwn(manifest.value, 'review_status') || Object.hasOwn(manifest.value, 'reviewer')) {
    malformed.push(manifest.path + ':review_gate_present');
  }
  if (!SHA256_PATTERN.test(manifest.value.source_set_sha256 ?? '')) {
    malformed.push(manifest.path + ':source_set_sha256');
  } else if (manifest.value.source_set_sha256 !== sourceDigest) {
    malformed.push(manifest.path + ':source_set_sha256_mismatch');
  }
  const entries = new Map();
  for (const entry of rawEntries) {
    if (!nonEmpty(entry?.path)) malformed.push(manifest.path + ':entry_path');
    else if (entries.has(entry.path)) malformed.push(entry.path + ':duplicate');
    else entries.set(entry.path, entry);
  }
  const missing = [];
  const stale = [];
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
    if (invalidFields.length > 0) malformed.push(item.path + ':' + invalidFields.join(','));
    if (Object.hasOwn(entry, 'review_status') || Object.hasOwn(entry, 'reviewer')) {
      malformed.push(item.path + ':review_gate_present');
    }
  }
  const expectedPaths = new Set(inventory.map((item) => item.path));
  const unexpected = [...entries.keys()].filter((path) => !expectedPaths.has(path)).sort();
  const complete = missing.length === 0
    && stale.length === 0
    && malformed.length === 0
    && unexpected.length === 0;
  return { complete, missing, stale, malformed, unexpected };
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

async function inspectNotices(root, noticeDocument, manifest, lockHash) {
  const issues = [];
  if (!noticeDocument?.exists) issues.push('THIRD_PARTY_NOTICES.md:missing');
  if (!manifest.exists) issues.push(manifest.path + ':missing');
  if (manifest.parse_error) issues.push(manifest.path + ':parse_error');
  if (issues.length > 0) return { complete: false, issues };

  const value = manifest.value;
  const lock = await readJson(join(root, 'package-lock.json'));
  const expected = new Map(Object.entries(lock.packages ?? {})
    .filter(([path, metadata]) => path.includes('node_modules/') && !metadata.link));
  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  const entries = new Map();
  if (!Array.isArray(value.entries)) issues.push(manifest.path + ':entries');
  for (const entry of rawEntries) {
    if (!nonEmpty(entry?.lock_path)) issues.push(manifest.path + ':entry_lock_path');
    else if (entries.has(entry.lock_path)) issues.push(entry.lock_path + ':duplicate');
    else entries.set(entry.lock_path, entry);
  }
  for (const [path, metadata] of expected) {
    if (!entries.has(path)) issues.push(path + ':missing');
    else if (!noticeEntryValid(entries.get(path), metadata)) issues.push(path + ':invalid');
  }
  for (const path of entries.keys()) {
    if (!expected.has(path)) issues.push(path + ':unexpected');
  }

  const noticeHash = noticeDocument?.exists ? await sha256(join(root, noticeDocument.path)) : null;
  if (value.schema_version !== 'third-party-notices-v1') issues.push(manifest.path + ':schema_version');
  if (value.status !== 'complete') issues.push(manifest.path + ':status');
  if (Object.hasOwn(value, 'review_status') || Object.hasOwn(value, 'reviewer')) {
    issues.push(manifest.path + ':review_gate_present');
  }
  if (value.lockfile_sha256 !== lockHash) issues.push(manifest.path + ':lockfile_sha256');
  if (value.notice_file !== noticeDocument?.path) issues.push(manifest.path + ':notice_file');
  if (value.notice_file_sha256 !== noticeHash) issues.push(manifest.path + ':notice_file_sha256');
  if (value.entries_sha256 !== sha256Text(JSON.stringify(rawEntries))) issues.push(manifest.path + ':entries_sha256');
  if (value.counts?.records !== expected.size) issues.push(manifest.path + ':record_count');
  return { complete: issues.length === 0, issues };
}

async function inspectIdentityAnchors(root, anchors = []) {
  const missing = [];
  for (const anchor of anchors) {
    const path = anchor?.path;
    if (!nonEmpty(path) || !nonEmpty(anchor?.contains) || !await exists(join(root, path))) {
      missing.push({ path: path ?? null, contains: anchor?.contains ?? null, reason: 'missing' });
      continue;
    }
    const content = await readFile(join(root, path), 'utf8');
    if (!content.includes(anchor.contains)) {
      missing.push({ path, contains: anchor.contains, reason: 'not_found' });
    }
  }
  return missing;
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
  const digestExcluded = new Set(policy.source_digest_exclusions ?? []);
  const sourceSetRecords = sourceRecords.filter((record) => !digestExcluded.has(record.path));
  const sourceDigest = sha256Text(sourceSetRecords
    .map((record) => record.path + '\0' + record.sha256)
    .join('\n'));
  const assets = sourceRecords.filter((record) => (policy.asset_extensions ?? [])
    .includes(extname(record.path).toLowerCase()));
  const publicCopyPaths = files.filter((path) => pathInRoots(path, policy.public_copy_roots ?? []) && isTextFile(path));
  const publicCopy = sourceRecords.filter((record) => publicCopyPaths.includes(record.path));

  const identity = await inspectLegacyIdentity(root, files, policy);
  const legacyOccurrences = Object.values(identity.results)
    .reduce((total, result) => total + result.occurrences, 0);
  const legacyPatterns = Object.entries(identity.results)
    .filter(([, result]) => result.occurrences > 0)
    .map(([pattern]) => pattern);
  const anchorsMissing = await inspectIdentityAnchors(root, policy.identity_anchors);

  const [assetManifestPath, copyManifestPath] = policy.required_manifests ?? [];
  const assetManifest = await inspectManifest(root, assetManifestPath);
  const copyManifest = await inspectManifest(root, copyManifestPath);
  const noticesManifest = await inspectManifest(root, policy.third_party_notices_manifest);
  const dependencyInventory = await inspectManifest(root, policy.dependency_inventory);
  const testing = await inspectManifest(root, policy.testing_result);
  const buildManifest = await inspectManifest(root, policy.build_manifest);
  const packageLicenses = await inspectPackageLicenses(root);
  const ignoreMissing = await inspectIgnoreContract(root, policy.ignore_contract);
  const assetCoverage = provenanceCoverage(assetManifest, assets, 'asset-provenance-v1', sourceDigest);
  const copyCoverage = provenanceCoverage(copyManifest, publicCopy, 'copy-provenance-v1', sourceDigest);
  const lockHash = await sha256(join(root, 'package-lock.json'));
  const dependencyInventoryValid = dependencyInventory.exists
    && !dependencyInventory.parse_error
    && dependencyInventory.value.source?.sha256 === lockHash
    && dependencyInventory.value.counts?.third_party_package_records > 0
    && dependencyInventory.value.project_metadata?.workspace_license_undeclared_count >= 0;
  const build = await inspectBuildManifest(root, buildManifest);
  const revision = options.revision ?? commandOutput('git', ['rev-parse', '--verify', 'HEAD'], root);
  const gitStatus = commandOutput('git', ['status', '--porcelain'], root);
  const untrackedCount = gitStatus === null ? null : gitStatus.split(/\r?\n/u)
    .filter((line) => line.startsWith('??')).length;
  const privateArtifacts = files.filter((path) => {
    const lower = path.toLowerCase();
    if (lower === '.env.example') return false;
    return lower === '.env' || lower.startsWith('.env.')
      || (policy.private_file_suffixes ?? []).some((suffix) => lower.endsWith(suffix));
  });
  const requiredDocs = await Promise.all((policy.required_public_documents ?? []).map(async (path) => ({
    path,
    exists: await exists(join(root, path)),
  })));
  const noticeDocument = requiredDocs.find((item) => item.path === 'THIRD_PARTY_NOTICES.md');
  const noticesCoverage = await inspectNotices(root, noticeDocument, noticesManifest, lockHash);
  const contributionDocs = requiredDocs.filter((item) => ['CONTRIBUTING.md', 'SECURITY.md'].includes(item.path));

  const checks = [];
  checks.push(check(
    'source_revision',
    revision ? 'PASS' : 'FAIL',
    revision ? 'A source revision identifies the candidate.' : 'The repository has no source revision.',
    { revision, untracked_count: untrackedCount },
  ));
  checks.push(check(
    'public_identity',
    anchorsMissing.length === 0 ? 'PASS' : 'FAIL',
    anchorsMissing.length === 0
      ? 'The candidate declares the BasicLinear public identity at each required public anchor.'
      : 'A required BasicLinear public identity anchor is missing or stale.',
    { public_identity: policy.public_identity ?? null, missing_anchors: anchorsMissing },
  ));
  checks.push(check(
    'legacy_identity_removal',
    legacyOccurrences === 0 ? 'PASS' : 'FAIL',
    legacyOccurrences === 0
      ? 'No legacy product-identity references remain in public source or documentation.'
      : 'Legacy product-identity references remain in public source or documentation.',
    { occurrences: legacyOccurrences, patterns: identity.results, unresolved_patterns: legacyPatterns },
  ));
  const licenseExists = requiredDocs.find((item) => item.path === 'LICENSE')?.exists === true;
  checks.push(check(
    'project_license',
    licenseExists && packageLicenses.missing.length === 0 ? 'PASS' : 'FAIL',
    licenseExists && packageLicenses.missing.length === 0
      ? 'The root and workspace packages declare a license.'
      : 'The root license or package license metadata is absent.',
    { root_license: licenseExists, package_manifests: packageLicenses.package_paths.length, missing_package_license: packageLicenses.missing },
  ));
  checks.push(check(
    'dependency_metadata_inventory',
    dependencyInventoryValid ? 'PASS' : 'FAIL',
    dependencyInventoryValid
      ? 'The dependency metadata inventory matches the lockfile.'
      : 'The dependency metadata inventory is missing or stale.',
    { inventory: policy.dependency_inventory, lock_sha256: lockHash },
  ));
  checks.push(check(
    'third_party_notices',
    noticesCoverage.complete ? 'PASS' : 'FAIL',
    noticesCoverage.complete
      ? 'The dependency notices are complete, classified, and hash-bound.'
      : 'The dependency notice evidence is missing, stale, malformed, or unclassified.',
    {
      path: noticeDocument?.path ?? 'THIRD_PARTY_NOTICES.md',
      manifest: noticesManifest.path,
      status: noticesManifest.value?.status ?? 'missing',
      counts: noticesManifest.value?.counts ?? null,
      issues: noticesCoverage.issues,
    },
  ));
  checks.push(check(
    'private_path_controls',
    ignoreMissing.length === 0 ? 'PASS' : 'FAIL',
    ignoreMissing.length === 0
      ? 'Private state and credential paths are excluded by the source ignore policy.'
      : 'A required private-path exclusion is missing.',
    { missing: ignoreMissing },
  ));
  checks.push(check(
    'private_artifact_scan',
    privateArtifacts.length === 0 && identity.secrets.length === 0 ? 'PASS' : 'FAIL',
    privateArtifacts.length === 0 && identity.secrets.length === 0
      ? 'No private artifact or high-confidence secret indicator was found.'
      : 'The candidate contains a private artifact or secret indicator.',
    { private_artifacts: privateArtifacts, secret_indicators: identity.secrets, symlinks },
  ));
  checks.push(check(
    'asset_provenance',
    assetCoverage.complete ? 'PASS' : 'FAIL',
    assetCoverage.complete
      ? 'Every binary asset has complete, hash-bound provenance.'
      : 'Binary asset provenance is missing, stale, or malformed.',
    { manifest: assetManifest.path, asset_count: assets.length, ...assetCoverage },
  ));
  checks.push(check(
    'copy_provenance',
    copyCoverage.complete ? 'PASS' : 'FAIL',
    copyCoverage.complete
      ? 'Every public-copy file has complete, hash-bound provenance.'
      : 'Public-copy provenance is missing, stale, or malformed.',
    { manifest: copyManifest.path, copy_file_count: publicCopy.length, ...copyCoverage },
  ));
  checks.push(check(
    'contribution_and_security_policy',
    contributionDocs.every((item) => item.exists) ? 'PASS' : 'FAIL',
    contributionDocs.every((item) => item.exists)
      ? 'Contribution and private vulnerability-reporting policies exist.'
      : 'Contribution or security policy is missing.',
    { documents: contributionDocs },
  ));
  checks.push(check(
    'reproducible_build_inputs',
    build.valid ? 'PASS' : 'FAIL',
    build.valid
      ? 'The local runtime build inputs and topology are hash-pinned.'
      : 'The local-runtime build manifest is missing, stale, or unsupported.',
    { manifest: buildManifest.path, status: buildManifest.value?.status ?? 'missing', mismatches: build.mismatches },
  ));
  const cleanHostPassed = testing.value?.planned_tests?.['P-T21'] === 'passed';
  checks.push(check(
    'clean_host_network_denied_runtime',
    cleanHostPassed ? 'PASS' : 'FAIL',
    cleanHostPassed
      ? 'The clean-host network-denied runtime check passed.'
      : 'P-T21 is not recorded as passed.',
    { result: policy.testing_result, observed: testing.value?.planned_tests?.['P-T21'] ?? 'missing' },
  ));

  const summary = {
    pass: checks.filter((item) => item.status === 'PASS').length,
    fail: checks.filter((item) => item.status === 'FAIL').length,
    blocked: 0,
  };
  return {
    schema_version: 'public-release-audit-v2',
    release: policy.release ?? 'BasicLinear open-source release',
    verdict: summary.fail === 0 ? 'READY' : 'NOT_READY',
    source: {
      revision,
      file_count: sourceSetRecords.length,
      sha256: sourceDigest,
    },
    inventory: { assets, public_copy: publicCopy },
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
    else throw new Error('Unknown argument: ' + argument);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node scripts/audit-public-release.mjs [--root PATH] [--policy PATH] [--write PATH]\\n');
    return;
  }
  const report = await auditPublicRelease(options.root, { policy: options.policy });
  const output = JSON.stringify(report, null, 2) + '\\n';
  if (options.write) await writeFile(resolve(options.root, options.write), output, 'utf8');
  else process.stdout.write(output);
  if (report.verdict !== 'READY') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write((error.stack ?? error.message) + '\\n');
    process.exitCode = 1;
  });
}
