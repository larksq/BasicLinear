#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const readJson = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(join(root, path))).digest('hex');
const writeJson = async (path, value) => writeFile(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
const pkg = await readJson('package.json');
const lock = await readJson('package-lock.json');
const records = Object.entries(lock.packages);
const nonLinks = records.filter(([, value]) => !value.link);
const workspaces = nonLinks.filter(([path]) => path !== '' && !path.includes('node_modules/'));
const dependencies = nonLinks.filter(([path]) => path.includes('node_modules/'));
const licenseCounts = {};
for (const [path, value] of nonLinks.filter(([path]) => path !== '')) {
  const key = `${value.license ?? 'UNDECLARED'}${path.includes('node_modules/') ? '' : '_PROJECT_WORKSPACE'}`;
  licenseCounts[key] = (licenseCounts[key] ?? 0) + 1;
}
const missingLicenses = dependencies.filter(([, value]) => !value.license).map(([path]) => path);
await writeJson('ops/release/dependency-license-inventory.json', {
  schema_version: 'release-dependency-license-inventory-v1',
  issue: 'CT-13',
  generated_at: new Date().toISOString(),
  status: 'metadata_screen_complete_distribution_audit_pending',
  source: {
    path: 'package-lock.json', sha256: await sha256('package-lock.json'),
    method: 'Count non-link lockfile records, separating the root, project workspaces, and third-party packages.',
  },
  counts: {
    all_lockfile_entries: records.length,
    workspace_link_entries: records.filter(([, value]) => value.link).length,
    non_link_entries_including_root: nonLinks.length,
    package_records_excluding_root: nonLinks.length - 1,
    project_workspace_packages: workspaces.length,
    third_party_package_records: dependencies.length,
  },
  package_record_license_counts: licenseCounts,
  project_metadata: {
    root_license_declared: Boolean(pkg.license),
    workspace_license_declared_count: workspaces.filter(([, value]) => value.license).length,
    workspace_license_undeclared_count: workspaces.filter(([, value]) => !value.license).length,
    declared_license: pkg.license,
    reason: 'Existing project license preserved; qualified compatibility review remains separate.',
  },
  missing_third_party_license_metadata: missingLicenses,
  findings: [
    `${missingLicenses.length} third-party package records have missing license metadata.`,
    'Metadata screening does not establish license compatibility or replace review of license and NOTICE files.',
    'The inventory includes local, hosted, development, and optional dependency records from the same lockfile.',
  ],
  historical_input: 'docs/product/versions/v0.1.0/10-discovery/CT-3/dependency-license-inventory.json',
  owner: 'CT-13 release audit with qualified review',
  decision_dependency: 'DEC-003',
});

const build = await readJson('ops/release/reproducible-build.json');
const inputPaths = new Set([
  ...build.inputs.map((input) => input.path),
  '.nvmrc', '.npmrc', '.gitleaks.toml', '.github/workflows/ci.yml',
  'tsconfig.json', 'apps/web/vite.config.ts', 'scripts/prepare-release-metadata.mjs',
]);
for (const base of ['apps', 'packages']) {
  for (const entry of await readdir(join(root, base), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of ['package.json', 'tsconfig.json']) {
      const path = `${base}/${entry.name}/${file}`;
      try { await readFile(join(root, path)); inputPaths.add(path); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
build.status = 'inputs_pinned_revision_pending';
build.source_revision = null;
build.toolchain = {
  node: (await readFile(join(root, '.nvmrc'), 'utf8')).trim(),
  npm: pkg.packageManager.replace(/^npm@/u, ''),
  package_manager_declaration: pkg.packageManager,
};
build.inputs = await Promise.all([...inputPaths].sort().map(async (path) => ({ path, sha256: await sha256(path) })));
await writeJson('ops/release/reproducible-build.json', build);
console.log(JSON.stringify({ workspace_packages: workspaces.length, third_party_records: dependencies.length,
  missing_license_metadata: missingLicenses.length, build_inputs: build.inputs.length,
  review_status: 'pending', source_revision: null }, null, 2));
