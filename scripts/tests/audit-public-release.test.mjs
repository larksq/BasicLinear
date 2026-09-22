import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { auditPublicRelease } from '../audit-public-release.mjs';
import { buildProvenanceEntry } from '../prepare-release-provenance.mjs';
import { prepareThirdPartyNotices } from '../prepare-third-party-notices.mjs';

async function write(root, path, value) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}

async function record(root, path) {
  const bytes = await readFile(join(root, path));
  return { path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function sourceDigest(root) {
  const records = [];
  async function walk(directory, relative = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) await walk(join(directory, entry.name), path);
      else if (entry.isFile() && ![
        'ops/release/assets.json',
        'ops/release/copy.json',
      ].includes(path)) records.push(await record(root, path));
    }
  }
  await walk(root);
  return createHash('sha256').update(records
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item) => item.path + '\0' + item.sha256)
    .join('\n')).digest('hex');
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'basiclinear-release-audit-'));
  const pkg = {
    name: 'basiclinear',
    private: true,
    packageManager: 'npm@11.16.0',
    license: 'AGPL-3.0-only',
    scripts: { start: 'node apps/api/dist/index.js' },
  };
  await write(root, 'package.json', pkg);
  await write(root, 'package-lock.json', {
    lockfileVersion: 3,
    packages: {
      '': { name: 'basiclinear', version: '0.1.0', license: 'AGPL-3.0-only' },
      'node_modules/example-package': { version: '1.0.0', license: 'MIT' },
    },
  });
  await write(root, '.gitignore', '.control-tower/\n.env\n.env.*\n.playwright-mcp/\n/backups/\n');
  await write(root, 'LICENSE', 'fixture license\n');
  await write(root, 'THIRD_PARTY_NOTICES.md', '# Notices\n');
  await write(root, 'CONTRIBUTING.md', '# Contributing\n');
  await write(root, 'SECURITY.md', '# Security\n');
  await write(root, 'README.md', '# BasicLinear\n');
  await write(root, 'apps/web/index.html', '<title>BasicLinear</title>\n');
  await write(root, 'apps/web/src/main.ts', "export const label = 'BasicLinear';\n");
  await write(root, 'apps/web/src/icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
  await write(root, 'docs/dependencies.json', { source: { sha256: (await record(root, 'package-lock.json')).sha256 }, counts: { third_party_package_records: 1 }, project_metadata: { workspace_license_undeclared_count: 0 } });
  await write(root, 'docs/testing.json', { planned_tests: { 'P-T21': 'passed' } });

  const lockHash = (await record(root, 'package-lock.json')).sha256;
  const noticesHash = (await record(root, 'THIRD_PARTY_NOTICES.md')).sha256;
  const noticeEntries = [{
    name: 'example-package',
    version: '1.0.0',
    declared_license: 'MIT',
    lock_path: 'node_modules/example-package',
    installed_on_inventory_host: false,
    local_evidence: [],
    distribution_scope: 'runtime_dependency',
    evidence_status: 'not_installed_on_inventory_host',
  }];
  await write(root, 'ops/release/notices.json', {
    schema_version: 'third-party-notices-v1',
    release: 'BasicLinear open-source release',
    status: 'complete',
    lockfile_sha256: lockHash,
    notice_file: 'THIRD_PARTY_NOTICES.md',
    notice_file_sha256: noticesHash,
    entries_sha256: createHash('sha256').update(JSON.stringify(noticeEntries)).digest('hex'),
    counts: { records: 1 },
    entries: noticeEntries,
  });
  await write(root, 'ops/release/build.json', {
    schema_version: 'reproducible-build-v2',
    release: 'BasicLinear open-source release',
    status: 'complete',
    runtime_topology: 'single_node_loopback_sqlite',
    start_command: 'node apps/api/dist/index.js',
    toolchain: { package_manager_declaration: 'npm@11.16.0' },
    inputs: [{ path: 'package-lock.json', sha256: lockHash }],
  });
  await write(root, 'policy.json', {
    schema_version: 'public-release-policy-v2',
    release: 'BasicLinear open-source release',
    ignored_roots: ['.git', '.control-tower', '.playwright-mcp', 'node_modules', 'dist', 'build', 'coverage', 'backups'],
    ignored_file_names: ['.DS_Store'],
    ignored_paths: [],
    source_digest_exclusions: ['ops/release/assets.json', 'ops/release/copy.json'],
    private_file_suffixes: ['.db', '.sqlite', '.sqlite3', '.pem', '.key', '.p12', '.pfx'],
    required_public_documents: ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md', 'SECURITY.md'],
    required_manifests: ['ops/release/assets.json', 'ops/release/copy.json'],
    public_identity: { name: 'BasicLinear' },
    identity_anchors: [
      { path: 'package.json', contains: '"name": "basiclinear"' },
      { path: 'apps/web/src/main.ts', contains: 'BasicLinear' },
    ],
    legacy_identity_patterns: ['OpenLinear', 'openlinear', '@openlinear/', 'Scopefold', 'scopefold'],
    identity_scan_roots: ['package.json', 'apps'],
    identity_scan_exclusions: [],
    dependency_inventory: 'docs/dependencies.json',
    third_party_notices_manifest: 'ops/release/notices.json',
    testing_result: 'docs/testing.json',
    build_manifest: 'ops/release/build.json',
    asset_extensions: ['.svg'],
    public_copy_roots: ['apps/web/index.html', 'apps/web/src/main.ts'],
    ignore_contract: { '.gitignore': ['.control-tower/', '.env', '.env.*', '.playwright-mcp/', '/backups/'] },
  });

  const digest = await sourceDigest(root);
  const icon = await record(root, 'apps/web/src/icon.svg');
  const copyEntries = [];
  for (const path of ['apps/web/index.html', 'apps/web/src/main.ts']) {
    copyEntries.push({
      ...await record(root, path),
      origin: 'independently_authored_project_source',
      source_reference: 'project_source:' + path,
      rights_basis: 'First-party fixture copy.',
    });
  }
  await write(root, 'ops/release/assets.json', {
    schema_version: 'asset-provenance-v1',
    release: 'BasicLinear open-source release',
    status: 'complete',
    source_set_sha256: digest,
    entries: [{
      ...icon,
      origin: 'first_party_project_asset',
      source_reference: 'project_source:apps/web/src/icon.svg',
      rights_basis: 'First-party fixture asset.',
    }],
  });
  await write(root, 'ops/release/copy.json', {
    schema_version: 'copy-provenance-v1',
    release: 'BasicLinear open-source release',
    status: 'complete',
    source_set_sha256: digest,
    entries: copyEntries,
  });
  return root;
}

test('passes a complete technical release fixture without a human acceptance', async () => {
  const root = await fixture();
  try {
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    assert.equal(report.verdict, 'READY');
    assert.deepEqual(report.summary, { pass: 13, fail: 0, blocked: 0 });
    for (const id of ['third_party_notices', 'asset_provenance', 'copy_provenance']) {
      assert.equal(report.checks.find((item) => item.id === id).status, 'PASS');
    }
    assert.equal(report.checks.some((item) => item.id === 'accountable_release_review'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('fails a legacy brand reference in public source', async () => {
  const root = await fixture();
  try {
    await write(root, 'apps/web/src/main.ts', "export const label = 'OpenLinear';\n");
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    const identity = report.checks.find((item) => item.id === 'legacy_identity_removal');
    assert.equal(identity.status, 'FAIL');
    assert.deepEqual(identity.evidence.unresolved_patterns, ['OpenLinear']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails stale or reviewer-gated provenance', async () => {
  const root = await fixture();
  try {
    const copy = JSON.parse(await readFile(join(root, 'ops/release/copy.json'), 'utf8'));
    copy.entries[0].review_status = 'approved';
    copy.entries[0].reviewer = 'not applicable';
    await write(root, 'ops/release/copy.json', copy);
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    const coverage = report.checks.find((item) => item.id === 'copy_provenance');
    assert.equal(coverage.status, 'FAIL');
    assert.ok(coverage.evidence.malformed.includes('apps/web/index.html:review_gate_present'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports secrets without exposing their values', async () => {
  const root = await fixture();
  try {
    const token = 'ghp_' + 'a'.repeat(32);
    await write(root, 'apps/web/src/private.ts', "export const token = '" + token + "';\n");
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    const privateScan = report.checks.find((item) => item.id === 'private_artifact_scan');
    assert.equal(privateScan.status, 'FAIL');
    assert.deepEqual(privateScan.evidence.secret_indicators, [{
      path: 'apps/web/src/private.ts',
      kind: 'github_token',
    }]);
    assert.equal(JSON.stringify(report).includes(token), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails unsupported build inputs', async () => {
  const root = await fixture();
  try {
    const build = JSON.parse(await readFile(join(root, 'ops/release/build.json'), 'utf8'));
    build.start_command = 'npm run start';
    await write(root, 'ops/release/build.json', build);
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    const buildCheck = report.checks.find((item) => item.id === 'reproducible_build_inputs');
    assert.equal(buildCheck.status, 'FAIL');
    assert.deepEqual(buildCheck.evidence.mismatches, [
      { path: 'ops/release/build.json', reason: 'unsupported_start_command' },
      { path: 'package.json', reason: 'start_command_mismatch' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('builds technical provenance without reviewer fields', () => {
  const record = { path: 'asset.svg', size: 12, sha256: 'a'.repeat(64) };
  const preserved = buildProvenanceEntry(new Map([[
    record.path,
    {
      ...record,
      origin: 'first_party_project_asset',
      source_reference: 'project_source:asset.svg',
      rights_basis: 'First-party fixture asset.',
      review_status: 'approved',
      reviewer: 'fixture-reviewer',
    },
  ]]), record, {});
  assert.deepEqual(preserved, {
    ...record,
    origin: 'first_party_project_asset',
    source_reference: 'project_source:asset.svg',
    rights_basis: 'First-party fixture asset.',
  });
});

test('generates technically complete notices without a review state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'basiclinear-third-party-notices-'));
  try {
    await write(root, 'package-lock.json', {
      lockfileVersion: 3,
      packages: {
        '': { name: 'basiclinear', version: '0.1.0' },
        'node_modules/runtime-package': { version: '1.0.0', license: 'MIT' },
      },
    });
    await prepareThirdPartyNotices(root);
    const manifest = JSON.parse(await readFile(join(root, 'ops/release/third-party-notices.json'), 'utf8'));
    assert.equal(manifest.status, 'complete');
    assert.equal(Object.hasOwn(manifest, 'review_status'), false);
    assert.equal(Object.hasOwn(manifest, 'reviewer'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
