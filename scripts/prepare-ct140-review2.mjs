import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';

const root = process.cwd();
const review1Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request.json');
const ct138Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-138/review-request-8.json');
const ct139Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-4.json');
const targetPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-2.json');
const review1 = JSON.parse(await readFile(review1Path, 'utf8'));
const ct138 = JSON.parse(await readFile(ct138Path, 'utf8'));
const ct139 = JSON.parse(await readFile(ct139Path, 'utf8'));

const excludedSegments = new Set([
  'node_modules', 'dist', 'coverage', '.git', '.playwright-mcp', '.firebase',
]);
const excludedNames = new Set(['firestore-debug.log', 'firebase-debug.log', '.DS_Store']);

async function walk(path) {
  const output = [];
  for (const entry of await readdir(resolve(root, path), {withFileTypes: true})) {
    if (excludedNames.has(entry.name) || excludedSegments.has(entry.name)) continue;
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) output.push(...await walk(child));
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

const files = new Set(Object.keys(review1.candidate.sha256));
for (const directory of [
  'apps', 'packages', 'scripts', 'ops', 'pmo', 'prototypes', 'skills',
  'docs/product/versions/v0.2.0', '.github',
]) {
  for (const path of await walk(directory)) files.add(path);
}
for (const path of [
  '.env.example', '.gitignore', '.npmrc', '.nvmrc', 'CONTRIBUTING.md', 'LICENSE',
  'README.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'firebase.json', 'firestore.rules',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts',
  'vitest.firestore.config.ts',
  '.control-tower/request-issue-get-140.json',
  '.control-tower/request-update-issue-140-review1-failure.json',
  '.control-tower/request-update-issue-140-review2-dispatch.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-12-44-845Z-16b45c9c-bd2b-4dab-8742-97dbd736b75f.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-23-02-617Z-d3fbaf92-ddfb-49e6-9e31-c9513b9cb910.json',
]) files.add(path);

files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-2.json');
files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/handoff.json');

const orderedFiles = [...files].sort();
const hashes = {};
for (const path of orderedFiles) {
  const absolute = resolve(root, path);
  if (!(await stat(absolute)).isFile()) throw new Error(`Candidate input is not a file: ${path}`);
  hashes[path] = createHash('sha256').update(await readFile(absolute)).digest('hex');
}

const ct138AuditedInputs = [
  '.npmrc',
  'apps/hosted-service/package.json',
  'apps/web/package.json',
  'package-lock.json',
  'package.json',
  'packages/config/package.json',
  'packages/hosted/package.json',
  'packages/ui/package.json',
];
const ct139OnlyInputs = [
  'apps/api/package.json',
  'ops/cli/package.json',
  'packages/contracts/package.json',
  'packages/db/package.json',
  'packages/domain/package.json',
  'packages/test-fixtures/package.json',
  'prototypes/ct-4/package.json',
];
for (const path of ct138AuditedInputs) {
  if (ct138.candidate.sha256[path] !== hashes[path]) {
    throw new Error(`CT-138 registry-audit ancestry mismatch: ${path}`);
  }
}
for (const path of ct139OnlyInputs) {
  if (ct139.candidate.sha256[path] !== hashes[path]) {
    throw new Error(`CT-139 current-input ancestry mismatch: ${path}`);
  }
}
const identity = (paths) => Object.fromEntries(paths.map((path) => [path, hashes[path]]));

const backups = [
  ...review1.authority.backups,
  {
    kind: 'review1_failure',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-12-44-845Z-16b45c9c-bd2b-4dab-8742-97dbd736b75f.json',
    sha256: '312f32cd556f2000bb2edffafac232370608e20e8027034b9173ade0cd66aa99',
    raw_file_sha256: 'b81ff5459c7cf5b34c99a7d6f66fe843e5b7b1dae50717e81c37812b57aedf0e',
  },
  {
    kind: 'review2_dispatch',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-23-02-617Z-d3fbaf92-ddfb-49e6-9e31-c9513b9cb910.json',
    sha256: 'e2f76c5ce8d1b7d7ad616a73c4e335072acf0d8a1ff2434fa3af65860acd51ce',
    raw_file_sha256: 'e2de8f08694d50b1c8c6df37e6163acc4645ac191d186c5bf96ec5acfe4d679e',
  },
];

const request = {
  ...review1,
  review_round: 2,
  prepared_at: '2026-08-25T23:25:00.000Z',
  authorized_at: '2026-08-25T23:25:00.000Z',
  dispatched_at: '2026-08-25T23:25:00.000Z',
  issue: {...review1.issue, revision: 6},
  authority: {...review1.authority, backups},
  candidate: {
    summary: 'Review-1-remediated stable 2026-07-28 stateless PM-only MCP with interoperable DCR application types, live-unused consent replay, immutable client-ID visibility, parameter-correct content negotiation, exact OAuth lifecycle, service parity, direct-Firestore denial, and validated PM skill; prohibited product scope remains absent.',
    intentionally_unsealed_inputs: {
      files: [
        'this Review 2 request file and the future handoff.json',
        '.control-tower/tasks-v0.8.sqlite3 and uncited historical backups',
        'node_modules and generated dist/coverage/emulator-log files',
        '.playwright-mcp captures, user outputs, Git internals, and unrelated historical documents not consumed by a required check',
        'live Firebase/Stripe/OAuth resources, credentials, deployment state, and network services',
      ],
      reason: 'The request cannot hash itself and the handoff does not yet exist. Review 1 evidence is sealed. The mutable CT store is attested by fresh API readback plus five sealed semantic/raw backups. Generated outputs derive from the sealed source/config universe. Excluded captures, outputs, unrelated documents, and live/provider state are not candidate inputs and are not authorized for mutation.',
    },
    sealed_file_count: orderedFiles.length,
    sealed_universe: [
      'the complete 431-file Review 1 universe, recomputed at current bytes',
      'every non-generated file under apps, packages, scripts, ops, pmo, prototypes, and the packaged skill',
      'every v0.2 discovery/planning/implementation file plus inherited v0.1 files consumed by required tests',
      'root build/test/Firebase/dependency/configuration, public assets/policies, Review 1 evidence, both remediation API requests, and five cited semantic/raw backups',
    ],
    sha256: hashes,
  },
  audit_evidence_boundary: {
    fresh_online_audit: false,
    reason: 'The restricted audit failed registry DNS and the scoped online rerun was policy-rejected because it would disclose dependency metadata to npm. Do not retry or circumvent that policy boundary.',
    accepted_evidence: [
      'npm audit --offline --omit=dev --omit=optional reports 0 vulnerabilities on the complete current dependency input universe',
      'npm ls --omit=dev --omit=optional --all exits 0',
      'exactly 8 inputs, including .npmrc, are byte-identical to and sealed by the independently registry-audited CT-138 Review 8 boundary',
      'the other 7 package manifests are byte-identical to CT-139 Review 4/current but carry no inherited CT-138 registry-audit claim',
    ],
    ct138_review8_registry_audited_exact_inputs: identity(ct138AuditedInputs),
    ct139_review4_current_only_exact_inputs: identity(ct139OnlyInputs),
    complete_current_dependency_input_identity: identity([...ct138AuditedInputs, ...ct139OnlyInputs].sort()),
  },
  required_checks: [
    {command: 'recompute candidate.sha256 and every cited semantic/raw backup before and after review', expected: `${orderedFiles.length}/${orderedFiles.length} exact SHA-256 entries; all 5/5 backup pairs exact`},
    {command: 'fresh project-local v0.8 API issue-get for CT-140 and CT-139', expected: 'CT-140 r6 In Progress on shared S3; CT-139 r11 Done; projection disabled/not_synced'},
    {command: 'npx vitest run packages/hosted/tests/mcp-oauth-service.test.ts packages/hosted/tests/mcp-server.test.ts packages/hosted/tests/automation-http.test.ts packages/hosted/tests/mcp-skill.test.ts apps/web/tests/hosted-mcp-consent.test.ts', expected: '5 files / 21 tests pass'},
    {command: 'npm run test:hosted-rules', expected: '1 file / 6 groups pass under official Firestore emulator with clean shutdown; scoped loopback escalation is permitted if the restricted bind returns EPERM'},
    {command: 'npm test', expected: '103 files / 676 tests pass'},
    {command: 'npm run typecheck', expected: 'all 11 workspace typecheck scripts pass'},
    {command: 'npm run build', expected: 'all builds pass; Vite transforms 1,953 local and 30 hosted modules'},
    {command: 'inspect apps/web/dist/hosted.html references', expected: 'favicon, one hosted JS, and one hosted CSS resolve 3/3; no local/editor/modulepreload coupling'},
    {command: 'npm ls --omit=dev --omit=optional --all', expected: 'exit 0 with the supported direct Firestore runtime'},
    {command: '/usr/bin/python3 skill-creator/scripts/quick_validate.py skills/basiclinear-product-management', expected: 'Skill is valid!'},
    {command: 'npm audit --offline --omit=dev --omit=optional and verify the two exact ancestry groups', expected: 'offline 0; CT-138 group 8/8 exact including .npmrc; CT-139/current-only group 7/7 exact; do not claim or retry a fresh online audit'},
    {command: 'git diff --check and parse every CT-140 JSON file', expected: 'pass'},
    {command: 'enumerate every workspace-owned input to required tests/typecheck/build/skill/emulator/evidence', expected: 'no unsealed input can alter a required result or hosted artifact'},
  ],
  adversarial_review_questions: [
    'Review 1 DCR closure: do application_type web and native reach registration successfully, while malformed values, duplicate top-level keys, unsafe redirects, unsupported modes, and extra fields fail before state mutation? Does omission remain safe for older non-OIDC clients?',
    'Review 1 consent-replay closure: does approval replay succeed at code expiry minus 1 ms, fail at exact expiry and after expiry, and fail after exchange/use, with all signed request/code/current-workspace/current-membership relations checked and snapshots unchanged on denial? Does the browser provide a bounded new-flow recovery message?',
    'Review 1 exact-client closure: does the actual accessible rendered consent identity visibly distinguish two DCR clients with the same name by immutable client ID while preserving exact redirect/workspace/scope/account/expiry visibility?',
    'Review 1 content-negotiation closure: do q = 0, empty parameters, duplicate q, unterminated quoted values, unsupported profile constraints, post-q parameters, and other malformed media ranges reject, while exact JSON/SSE with valid nonzero qualities and matching UTF-8 charset constraints pass?',
    'Review 1 audit-provenance closure: independently verify the 8/8 CT-138 Review 8 registry-audited inputs including .npmrc, the separate 7/7 CT-139/current-only manifests, all 15 current inputs, and the absence of any broader inherited online-audit claim.',
    ...review1.adversarial_review_questions,
    `Is the ${orderedFiles.length}-file Review 2 evidence boundary complete for every executable/imported/build/test/emulator/skill/config/public-asset/documented claim, and does it remain exact after all checks?`,
  ],
  decision_contract: {
    ...review1.decision_contract,
    on_fail: 'Return a severity-ranked report with exact evidence and bounded remediation; CT-140 remains In Progress and must be resealed for Review 3.',
    on_pass: 'Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review 2 and perform a revision-checked Done update/readback.',
  },
};

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared ${relative(root, targetPath).split(sep).join('/')} with ${orderedFiles.length} sealed files.`);
