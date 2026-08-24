import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  auditPublicRelease,
  QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS,
  REQUIRED_RELEASE_REVIEW_SCOPES,
} from '../audit-public-release.mjs';
import { buildProvenanceEntry } from '../prepare-release-provenance.mjs';
import { prepareQualifiedIdentityReview } from '../prepare-qualified-identity-review.mjs';
import { prepareReleaseReview } from '../prepare-release-review.mjs';
import { prepareThirdPartyNotices } from '../prepare-third-party-notices.mjs';

async function write(root, path, value) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

async function fileRecord(root, path) {
  const bytes = await readFile(join(root, path));
  return { path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function acceptCurrentReview(root) {
  const preparation = await prepareReleaseReview(root, {
    policy: 'policy.json',
    revision: 'deadbeef',
    requireClean: false,
  });
  await write(root, 'ops/release/review.json', {
    schema_version: 'release-review-acceptance-v1',
    issue: 'CT-13',
    status: 'accepted',
    reviewer: {
      name: 'Fixture Reviewer',
      role: 'Accountable release reviewer',
      qualification: 'Fixture qualification',
    },
    reviewed_at: '2026-08-22T00:00:00Z',
    jurisdictions: ['fixture-jurisdiction'],
    request_sha256: preparation.sha256,
    accepted_scopes: REQUIRED_RELEASE_REVIEW_SCOPES,
  });
  return preparation;
}

async function acceptCurrentQualifiedIdentityReview(root) {
  const preparation = await prepareQualifiedIdentityReview(root, {
    policy: 'policy.json',
    revision: 'deadbeef',
    requireClean: false,
  });
  await write(root, 'docs/qualified-acceptance.json', {
    schema_version: 'qualified-identity-review-acceptance-v1',
    issue: 'CT-3',
    status: 'accepted',
    reviewer: {
      name: 'Fixture Reviewer',
      role: 'Qualified identity reviewer',
      qualification: 'Fixture qualification',
    },
    reviewed_at: '2026-08-22T00:00:00Z',
    jurisdictions: ['fixture-jurisdiction'],
    request_sha256: preparation.sha256,
    dispositions: QUALIFIED_IDENTITY_ACCEPTED_DISPOSITIONS,
  });
  return preparation;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'public-release-audit-'));
  const pkg = {
    name: 'distinct-project',
    private: true,
    packageManager: 'npm@11.16.0',
    license: 'AGPL-3.0-only',
    scripts: { start: 'node apps/api/dist/index.js' },
  };
  await write(root, 'package.json', pkg);
  await write(root, 'package-lock.json', {
    lockfileVersion: 3,
    packages: {
      '': { name: 'distinct-project', version: '0.1.0', license: 'AGPL-3.0-only' },
      'node_modules/example-package': { version: '1.0.0', license: 'MIT' },
    },
  });
  await write(root, '.gitignore', '.control-tower/\n.env\n.env.*\n.playwright-mcp/\n/backups/\n');
  const generatedBrowserToken = `ghp_${'z'.repeat(32)}`;
  await write(root, '.playwright-mcp/page.yml', `snapshot: ${generatedBrowserToken}\n`);
  await write(root, 'LICENSE', 'fixture license\n');
  await write(root, 'THIRD_PARTY_NOTICES.md', '# Notices\n');
  await write(root, 'CONTRIBUTING.md', '# Contributing\n');
  await write(root, 'SECURITY.md', '# Security\n');
  await write(root, 'apps/web/index.html', '<title>Distinct project</title>\n');
  await write(root, 'apps/web/src/main.ts', "export const label = 'Distinct project';\n");
  await write(root, 'apps/web/src/icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
  await write(root, 'docs/decision.json', {
    status: 'accepted',
    completed: true,
    sponsor_decision: {
      license: 'AGPL-3.0-only',
      project_identity: 'Scopefold',
      requested_final_product_brand: 'OpenLinear',
    },
  });
  await write(root, 'docs/decision-evidence.md', '# Qualified decision evidence\n');
  const lockHash = (await fileRecord(root, 'package-lock.json')).sha256;
  const noticesHash = (await fileRecord(root, 'THIRD_PARTY_NOTICES.md')).sha256;
  await write(root, 'docs/dependencies.json', {
    source: { sha256: lockHash },
    counts: { third_party_package_records: 1 },
    project_metadata: { workspace_license_undeclared_count: 0 },
  });
  await write(root, 'docs/testing.json', { planned_tests: { 'P-T21': 'passed' } });
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
    status: 'approved',
    review_status: 'approved',
    reviewer: 'fixture-reviewer',
    lockfile_sha256: lockHash,
    notice_file: 'THIRD_PARTY_NOTICES.md',
    notice_file_sha256: noticesHash,
    entries_sha256: createHash('sha256').update(JSON.stringify(noticeEntries)).digest('hex'),
    counts: { records: 1 },
    entries: noticeEntries,
  });
  await write(root, 'ops/release/build.json', {
    status: 'accepted',
    runtime_topology: 'single_node_loopback_sqlite',
    start_command: 'node apps/api/dist/index.js',
    toolchain: { package_manager_declaration: 'npm@11.16.0' },
    inputs: [{ path: 'package-lock.json', sha256: lockHash }],
  });
  const icon = await fileRecord(root, 'apps/web/src/icon.svg');
  const copyEntries = [];
  for (const path of ['apps/web/index.html', 'apps/web/src/main.ts']) {
    const record = await fileRecord(root, path);
    copyEntries.push({
      ...record,
      origin: 'independently_authored_project_source',
      source_reference: `project_source:${path}`,
      rights_basis: 'First-party fixture copy.',
      review_status: 'approved',
      reviewer: 'fixture-reviewer',
    });
  }
  await write(root, 'ops/release/assets.json', {
    schema_version: 'asset-provenance-v1',
    status: 'approved',
    review_status: 'approved',
    source_set_sha256: 'a'.repeat(64),
    entries: [{
      ...icon,
      origin: 'first_party_project_asset',
      source_reference: 'project_source:apps/web/src/icon.svg',
      rights_basis: 'First-party fixture asset.',
      review_status: 'approved',
      reviewer: 'fixture-reviewer',
    }],
  });
  await write(root, 'ops/release/copy.json', {
    schema_version: 'copy-provenance-v1',
    status: 'approved',
    review_status: 'approved',
    source_set_sha256: 'a'.repeat(64),
    entries: copyEntries,
  });
  await write(root, 'policy.json', {
    schema_version: 'public-release-policy-v1',
    issue: 'CT-13',
    test: 'P-T22',
    ignored_roots: ['.git', '.control-tower', '.playwright-mcp', 'node_modules', 'dist', 'build', 'coverage', 'backups'],
    ignored_file_names: ['.DS_Store'],
    ignored_paths: [],
    source_digest_exclusions: [
      'ops/release/assets.json',
      'ops/release/copy.json',
      'docs/qualified-request.json',
      'docs/qualified-acceptance.json',
      'ops/release/request.json',
      'ops/release/review.json',
    ],
    private_file_suffixes: ['.db', '.sqlite', '.sqlite3', '.pem', '.key', '.p12', '.pfx'],
    required_public_documents: ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md', 'SECURITY.md'],
    required_manifests: ['ops/release/assets.json', 'ops/release/copy.json', 'ops/release/review.json'],
    review_request_manifest: 'ops/release/request.json',
    qualified_identity_review: {
      request_manifest: 'docs/qualified-request.json',
      acceptance_manifest: 'docs/qualified-acceptance.json',
      required_sponsor_decision: {
        license: 'AGPL-3.0-only',
        project_identity: 'Scopefold',
        requested_final_product_brand: 'OpenLinear',
      },
      accepted_identity_patterns: ['OpenLinear', 'openlinear', '@openlinear/'],
      evidence_documents: [
        'LICENSE',
        'THIRD_PARTY_NOTICES.md',
        'CONTRIBUTING.md',
        'SECURITY.md',
        'docs/decision-evidence.md',
        'docs/dependencies.json',
        'ops/release/notices.json',
        'ops/release/assets.json',
        'ops/release/copy.json',
      ],
    },
    decision_result: 'docs/decision.json',
    dependency_inventory: 'docs/dependencies.json',
    third_party_notices_manifest: 'ops/release/notices.json',
    testing_result: 'docs/testing.json',
    build_manifest: 'ops/release/build.json',
    working_identity_patterns: ['InternalCodename', 'internalcodename'],
    identity_scan_roots: ['package.json', 'apps'],
    asset_extensions: ['.svg'],
    public_copy_roots: ['apps/web/index.html', 'apps/web/src/main.ts'],
    ignore_contract: {
      '.gitignore': ['.control-tower/', '.env', '.env.*', '.playwright-mcp/', '/backups/'],
    },
  });
  await acceptCurrentQualifiedIdentityReview(root);
  await acceptCurrentReview(root);
  return root;
}

test('passes a complete hash-bound release fixture', async () => {
  const root = await fixture();
  try {
    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    assert.equal(report.verdict, 'READY');
    assert.deepEqual(report.summary, { pass: 14, fail: 0, blocked: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('blocks technically complete provenance that awaits accountable review', async () => {
  const root = await fixture();
  try {
    for (const path of ['ops/release/assets.json', 'ops/release/copy.json']) {
      const manifest = JSON.parse(await readFile(join(root, path), 'utf8'));
      manifest.status = 'ready_for_accountable_review';
      manifest.review_status = 'pending';
      manifest.entries = manifest.entries.map((entry) => ({
        ...entry,
        review_status: 'pending',
        reviewer: null,
      }));
      await write(root, path, manifest);
    }
    const noticesPath = join(root, 'ops/release/notices.json');
    const notices = JSON.parse(await readFile(noticesPath, 'utf8'));
    notices.status = 'ready_for_accountable_review';
    notices.review_status = 'pending';
    notices.reviewer = null;
    await write(root, 'ops/release/notices.json', notices);
    await acceptCurrentQualifiedIdentityReview(root);
    await rm(join(root, 'ops/release/review.json'));
    await prepareReleaseReview(root, {
      policy: 'policy.json',
      revision: 'deadbeef',
      requireClean: false,
    });

    const report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    assert.equal(report.verdict, 'NOT_READY');
    assert.deepEqual(report.summary, { pass: 10, fail: 0, blocked: 4 });
    for (const id of ['third_party_notices', 'asset_provenance', 'copy_provenance']) {
      assert.equal(report.checks.find((item) => item.id === id).status, 'BLOCKED');
    }
    assert.equal(report.checks.find((item) => item.id === 'accountable_release_review').status, 'BLOCKED');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('requires exact qualified identity review beyond an accepted CT-3 result', async () => {
  const root = await fixture();
  try {
    await rm(join(root, 'docs/qualified-acceptance.json'));
    await prepareQualifiedIdentityReview(root, {
      policy: 'policy.json',
      revision: 'deadbeef',
      requireClean: false,
    });
    await acceptCurrentReview(root);

    let report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    let identity = report.checks.find((item) => item.id === 'public_identity_decision');
    assert.equal(identity.status, 'BLOCKED');
    assert.equal(identity.evidence.qualified_review.request.status, 'valid');
    assert.equal(identity.evidence.qualified_review.acceptance.status, 'missing');

    await write(root, 'docs/qualified-acceptance.json', {
      status: 'accepted',
      reviewer: 'fixture-reviewer',
    });
    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    identity = report.checks.find((item) => item.id === 'public_identity_decision');
    assert.equal(identity.status, 'FAIL');
    assert.ok(identity.evidence.qualified_review.acceptance.issues.includes('acceptance.schema_version'));
    assert.ok(identity.evidence.qualified_review.acceptance.issues.includes('acceptance.reviewer'));
    assert.ok(identity.evidence.qualified_review.acceptance.issues.includes('acceptance.dispositions'));

    await acceptCurrentQualifiedIdentityReview(root);
    const placeholderAcceptancePath = join(root, 'docs/qualified-acceptance.json');
    const placeholderAcceptance = JSON.parse(await readFile(placeholderAcceptancePath, 'utf8'));
    placeholderAcceptance.reviewer.name = 'REQUIRED_REAL_NAME';
    placeholderAcceptance.jurisdictions = ['REQUIRED_REVIEW_JURISDICTION'];
    await write(root, 'docs/qualified-acceptance.json', placeholderAcceptance);
    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    identity = report.checks.find((item) => item.id === 'public_identity_decision');
    assert.equal(identity.status, 'FAIL');
    assert.ok(identity.evidence.qualified_review.acceptance.issues.includes('acceptance.reviewer.name'));
    assert.ok(identity.evidence.qualified_review.acceptance.issues.includes('acceptance.jurisdictions'));

    const preparation = await acceptCurrentQualifiedIdentityReview(root);
    const acceptancePath = join(root, 'docs/qualified-acceptance.json');
    const acceptance = JSON.parse(await readFile(acceptancePath, 'utf8'));
    acceptance.status = 'remediation_required';
    acceptance.request_sha256 = preparation.sha256;
    acceptance.dispositions.project_identity = 'remediation_required';
    acceptance.remediation = 'Select a cleared project identity.';
    await write(root, 'docs/qualified-acceptance.json', acceptance);
    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    identity = report.checks.find((item) => item.id === 'public_identity_decision');
    assert.equal(identity.status, 'FAIL');
    assert.equal(identity.evidence.qualified_review.acceptance.status, 'remediation_required');
    assert.deepEqual(identity.evidence.qualified_review.acceptance.issues, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails qualified review preparation when required evidence or sponsor choices are absent', async () => {
  const root = await fixture();
  try {
    await rm(join(root, 'docs/decision-evidence.md'));
    await assert.rejects(
      prepareQualifiedIdentityReview(root, {
        policy: 'policy.json',
        revision: 'deadbeef',
        requireClean: false,
      }),
      /request\.evidence\.docs\/decision-evidence\.md:missing/u,
    );

    await write(root, 'docs/decision-evidence.md', '# Qualified decision evidence\n');
    const decisionPath = join(root, 'docs/decision.json');
    const decision = JSON.parse(await readFile(decisionPath, 'utf8'));
    decision.sponsor_decision.project_identity = 'Unexpected identity';
    await write(root, 'docs/decision.json', decision);
    await assert.rejects(
      prepareQualifiedIdentityReview(root, {
        policy: 'policy.json',
        revision: 'deadbeef',
        requireClean: false,
      }),
      /request\.sponsor_decision\.project_identity:unexpected/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('allows only qualified public identity patterns after CT-3 reconciliation', async () => {
  const root = await fixture();
  try {
    const policyPath = join(root, 'policy.json');
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    policy.working_identity_patterns = ['OpenLinear'];
    await write(root, 'policy.json', policy);
    await write(root, 'apps/web/src/main.ts', "export const label = 'OpenLinear';\n");

    let report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    let identity = report.checks.find((item) => item.id === 'working_codename_removal');
    assert.equal(identity.status, 'PASS');
    assert.equal(identity.evidence.accepted_as_public_identity, true);

    policy.working_identity_patterns.push('InternalCodename');
    await write(root, 'policy.json', policy);
    await write(root, 'apps/web/src/main.ts', "export const label = 'OpenLinear InternalCodename';\n");
    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    identity = report.checks.find((item) => item.id === 'working_codename_removal');
    assert.equal(identity.status, 'FAIL');
    assert.deepEqual(identity.evidence.unresolved_patterns, ['InternalCodename']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects underspecified or stale accountable acceptance', async () => {
  const root = await fixture();
  try {
    await write(root, 'ops/release/review.json', { status: 'accepted', reviewer: 'fixture-reviewer' });
    let report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    let review = report.checks.find((item) => item.id === 'accountable_release_review');
    assert.equal(review.status, 'FAIL');
    assert.ok(review.evidence.acceptance.issues.includes('acceptance.schema_version'));
    assert.ok(review.evidence.acceptance.issues.includes('acceptance.reviewer'));
    assert.ok(review.evidence.acceptance.issues.includes('acceptance.accepted_scopes'));

    await acceptCurrentReview(root);
    const acceptancePath = join(root, 'ops/release/review.json');
    const acceptance = JSON.parse(await readFile(acceptancePath, 'utf8'));
    acceptance.request_sha256 = 'b'.repeat(64);
    await write(root, 'ops/release/review.json', acceptance);
    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    review = report.checks.find((item) => item.id === 'accountable_release_review');
    assert.equal(review.status, 'FAIL');
    assert.deepEqual(review.evidence.acceptance.issues, ['acceptance.request_sha256']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports secrets, stale hashes, and pending gates without exposing secret values', async () => {
  const root = await fixture();
  try {
    const token = `ghp_${'a'.repeat(32)}`;
    await write(root, 'apps/web/src/private.ts', `export const token = '${token}';\n`);
    await write(root, 'apps/web/src/main.ts', "export const label = 'InternalCodename';\n");
    const report = await auditPublicRelease(root, { policy: 'policy.json' });
    assert.equal(report.verdict, 'NOT_READY');
    assert.ok(report.summary.fail > 0);
    assert.ok(report.summary.blocked > 0);
    const privateScan = report.checks.find((item) => item.id === 'private_artifact_scan');
    assert.deepEqual(privateScan.evidence.secret_indicators, [{
      path: 'apps/web/src/private.ts',
      kind: 'github_token',
    }]);
    assert.ok(!JSON.stringify(report).includes(token));
    assert.equal(report.checks.find((item) => item.id === 'working_codename_removal').status, 'FAIL');
    assert.equal(report.checks.find((item) => item.id === 'copy_provenance').status, 'FAIL');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects package drift and unsupported manifest start commands', async () => {
  const root = await fixture();
  try {
    const packagePath = join(root, 'package.json');
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    pkg.scripts.start = 'npm run start -w @openlinear/api';
    await write(root, 'package.json', pkg);

    let report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    let buildCheck = report.checks.find((item) => item.id === 'reproducible_build_inputs');
    assert.equal(buildCheck.status, 'FAIL');
    assert.deepEqual(buildCheck.evidence.mismatches, [{
      path: 'package.json',
      reason: 'start_command_mismatch',
    }]);

    pkg.scripts.start = 'node apps/api/dist/index.js';
    await write(root, 'package.json', pkg);
    const buildPath = join(root, 'ops/release/build.json');
    const build = JSON.parse(await readFile(buildPath, 'utf8'));
    build.start_command = 'npm run start -w @openlinear/api';
    await write(root, 'ops/release/build.json', build);

    report = await auditPublicRelease(root, { policy: 'policy.json', revision: 'deadbeef' });
    buildCheck = report.checks.find((item) => item.id === 'reproducible_build_inputs');
    assert.equal(buildCheck.status, 'FAIL');
    assert.deepEqual(buildCheck.evidence.mismatches, [
      { path: 'ops/release/build.json', reason: 'unsupported_start_command' },
      { path: 'package.json', reason: 'start_command_mismatch' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preserves only exact valid provenance approvals', () => {
  const defaults = {
    origin: 'first_party_project_asset',
    source_reference: 'project_source:asset.svg',
    rights_basis: 'First-party fixture asset.',
  };
  const record = { path: 'asset.svg', size: 12, sha256: 'a'.repeat(64) };
  const approved = {
    ...record,
    ...defaults,
    review_status: 'approved',
    reviewer: 'fixture-reviewer',
  };
  assert.strictEqual(buildProvenanceEntry(new Map([[record.path, approved]]), record, defaults), approved);

  const changed = buildProvenanceEntry(
    new Map([[record.path, approved]]),
    { ...record, sha256: 'b'.repeat(64) },
    defaults,
  );
  assert.equal(changed.review_status, 'pending');
  assert.equal(changed.reviewer, null);

  const malformed = buildProvenanceEntry(
    new Map([[record.path, { ...approved, rights_basis: '' }]]),
    record,
    defaults,
  );
  assert.equal(malformed.review_status, 'pending');
  assert.equal(malformed.reviewer, null);
  assert.equal(malformed.rights_basis, defaults.rights_basis);
});

test('classifies every lock record and never self-approves notices', async () => {
  const root = await mkdtemp(join(tmpdir(), 'third-party-notices-'));
  try {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { name: 'fixture', version: '0.1.0' },
        'node_modules/runtime-package': { version: '1.0.0', license: 'MIT' },
        'node_modules/dev-package': { version: '2.0.0', license: 'Apache-2.0', dev: true },
        'node_modules/optional-package': { version: '3.0.0', license: 'ISC', optional: true },
      },
    };
    await write(root, 'package-lock.json', lock);
    await prepareThirdPartyNotices(root);
    const manifestPath = join(root, 'ops/release/third-party-notices.json');
    let manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.status, 'ready_for_accountable_review');
    assert.equal(manifest.review_status, 'pending');
    assert.equal(manifest.reviewer, null);
    assert.deepEqual(manifest.entries.map((entry) => entry.distribution_scope), [
      'development_dependency',
      'optional_runtime_dependency',
      'runtime_dependency',
    ]);

    manifest.status = 'approved';
    manifest.review_status = 'approved';
    manifest.reviewer = 'fixture-reviewer';
    await write(root, 'ops/release/third-party-notices.json', manifest);
    await prepareThirdPartyNotices(root);
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.status, 'approved');
    assert.equal(manifest.reviewer, 'fixture-reviewer');

    lock.packages['node_modules/runtime-package'].version = '1.0.1';
    await write(root, 'package-lock.json', lock);
    await prepareThirdPartyNotices(root);
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.status, 'ready_for_accountable_review');
    assert.equal(manifest.review_status, 'pending');
    assert.equal(manifest.reviewer, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
