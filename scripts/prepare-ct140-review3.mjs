import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';

const root = process.cwd();
const review2Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-2.json');
const ct138Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-138/review-request-8.json');
const ct139Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-4.json');
const targetPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-3.json');
const review2 = JSON.parse(await readFile(review2Path, 'utf8'));
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

const files = new Set(Object.keys(review2.candidate.sha256));
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
  '.control-tower/request-update-issue-140-review2-failure.json',
  '.control-tower/request-update-issue-140-review3-dispatch.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-12-44-845Z-16b45c9c-bd2b-4dab-8742-97dbd736b75f.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-23-02-617Z-d3fbaf92-ddfb-49e6-9e31-c9513b9cb910.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-52-26-332Z-323bdf22-50da-4d84-89e8-dafa4c334a5f.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-59-17-181Z-c97592cb-1b16-44ea-9d4b-6f5b22aaae9b.json',
]) files.add(path);

files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-3.json');
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
  ...review2.authority.backups,
  {
    kind: 'review2_failure',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-52-26-332Z-323bdf22-50da-4d84-89e8-dafa4c334a5f.json',
    sha256: '683b58653a9d751fe91968dff7ba0ee1ba3972743593cb4b437c9a16a13e5c99',
    raw_file_sha256: '8081a5a988201b7b3a8357d3e6d636494a9a166c342eaced020c21882378f44f',
  },
  {
    kind: 'review3_dispatch',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-59-17-181Z-c97592cb-1b16-44ea-9d4b-6f5b22aaae9b.json',
    sha256: '296e4cf71269f686fcbad57220e99f3ac508c73ae1051dfcca902a14e3b9448b',
    raw_file_sha256: '1ed621961b7e15cd4c60d4ac4e6b54196bec55ecea92a2b52230fe5225a9c731',
  },
];

const now = new Date().toISOString();
const request = {
  ...review2,
  review_round: 3,
  prepared_at: now,
  authorized_at: now,
  dispatched_at: now,
  issue: {...review2.issue, revision: 8},
  authority: {...review2.authority, backups},
  candidate: {
    summary: 'Review-2-remediated stable 2026-07-28 stateless PM-only MCP with cancellation tracked before asynchronous authentication and rechecked before headers and application work, plus interoperable DCR, exact OAuth lifecycle, service parity, direct-Firestore denial, and validated PM skill; prohibited product scope remains absent.',
    intentionally_unsealed_inputs: {
      files: [
        'this Review 3 request file and the future handoff.json',
        '.control-tower/tasks-v0.8.sqlite3 and uncited historical backups',
        'node_modules and generated dist/coverage/emulator-log files',
        '.playwright-mcp captures, user outputs, Git internals, and unrelated historical documents not consumed by a required check',
        'live Firebase/Stripe/OAuth resources, credentials, deployment state, and network services',
      ],
      reason: 'The request cannot hash itself and the handoff does not yet exist. Review 1 and Review 2 evidence is sealed. The mutable CT store is attested by fresh API readback plus seven sealed semantic/raw backups. Generated outputs derive from the sealed source/config universe. Excluded captures, outputs, unrelated documents, and live/provider state are not candidate inputs and are not authorized for mutation.',
    },
    sealed_file_count: orderedFiles.length,
    sealed_universe: [
      'the complete 438-file Review 2 universe, recomputed at current bytes',
      'every non-generated file under apps, packages, scripts, ops, pmo, prototypes, and the packaged skill, including the built-handler loopback cancellation probe',
      'every v0.2 discovery/planning/implementation file plus inherited v0.1 files consumed by required tests',
      'root build/test/Firebase/dependency/configuration, public assets/policies, Review 1/2 evidence, all remediation API requests, and seven cited semantic/raw backups',
    ],
    sha256: hashes,
  },
  audit_evidence_boundary: {
    fresh_online_audit: false,
    reason: 'The earlier restricted audit failed registry DNS and the scoped online rerun was policy-rejected because it would disclose dependency metadata to npm. Do not retry or circumvent that policy boundary.',
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
    {command: 'recompute candidate.sha256 and every cited semantic/raw backup before and after review', expected: `${orderedFiles.length}/${orderedFiles.length} exact SHA-256 entries; all 7/7 backup pairs exact`},
    {command: 'fresh project-local v0.8 API issue-get for CT-140 and CT-139', expected: 'CT-140 r8 In Progress on shared S3; CT-139 r11 Done; projection disabled/not_synced'},
    {command: 'npx vitest run packages/hosted/tests/mcp-oauth-service.test.ts packages/hosted/tests/mcp-server.test.ts packages/hosted/tests/automation-http.test.ts packages/hosted/tests/mcp-skill.test.ts apps/web/tests/hosted-mcp-consent.test.ts', expected: '5 files / 22 tests pass'},
    {command: 'npm run build -w @openlinear/hosted && node scripts/tests/ct140-mcp-cancellation-loopback.mjs', expected: 'built real-loopback delayed-auth close passes with closedBeforeAuthenticationResolved=true and zero service/audit/idempotency/project mutation; scoped loopback escalation is permitted if restricted bind returns EPERM'},
    {command: 'npm run test:hosted-rules', expected: '1 file / 6 groups pass under official Firestore emulator with clean shutdown; scoped loopback escalation is permitted if restricted bind returns EPERM'},
    {command: 'npm test', expected: '103 files / 677 tests pass'},
    {command: 'npm run typecheck', expected: 'all 11 workspace typecheck scripts pass'},
    {command: 'npm run build', expected: 'all builds pass; Vite transforms 1,953 local and 30 hosted modules'},
    {command: 'inspect apps/web/dist/hosted.html references', expected: 'favicon, one hosted JS, and one hosted CSS resolve 3/3; no local/editor/modulepreload coupling'},
    {command: 'npm ls --omit=dev --omit=optional --all', expected: 'exit 0 with the supported direct Firestore runtime'},
    {command: '/usr/bin/python3 skill-creator/scripts/quick_validate.py skills/openlinear-product-management', expected: 'Skill is valid!'},
    {command: 'npm audit --offline --omit=dev --omit=optional and verify the two exact ancestry groups', expected: 'offline 0; CT-138 group 8/8 exact including .npmrc; CT-139/current-only group 7/7 exact; do not claim or retry a fresh online audit'},
    {command: 'git diff --check and parse every CT-140 JSON file', expected: 'pass'},
    {command: 'enumerate every workspace-owned input to required tests/typecheck/build/skill/emulator/loopback/evidence', expected: 'no unsealed input can alter a required result or hosted artifact'},
  ],
  adversarial_review_questions: [
    'Review 2 cancellation closure: using an actual loopback server and built handler, block OAuth authentication after a valid mutation request is parsed, close the client, observe the server close, then resolve authentication. Are PM service calls, audits, idempotency records, repositories, response headers/body, and listener counts all untouched or cleaned up?',
    'Do direct requests already marked aborted, responses already marked destroyed, an event emitted before the listener attaches, a close after listeners attach but before authentication resolves, and a close after headers but before the next-turn work boundary all return without service work? Does listener cleanup also hold on success, validation error, authentication error, and cancellation?',
    'Is the promise deliberately bounded only before application work, without claiming rollback after a tool has begun? Can any mutation or destructive tool bypass the common cancellation check through a separate path?',
    ...review2.adversarial_review_questions,
    `Is the ${orderedFiles.length}-file Review 3 evidence boundary complete for every executable/imported/build/test/emulator/loopback/skill/config/public-asset/documented claim, and does it remain exact after all checks?`,
  ],
  decision_contract: {
    ...review2.decision_contract,
    on_fail: 'Return a severity-ranked report with exact evidence and bounded remediation; CT-140 remains In Progress and must be resealed for Review 4.',
    on_pass: 'Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review 3 and perform a revision-checked Done update/readback.',
  },
};

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared ${relative(root, targetPath).split(sep).join('/')} with ${orderedFiles.length} sealed files.`);
