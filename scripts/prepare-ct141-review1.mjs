import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';

const root = process.cwd();
const requestedRound = Number.parseInt(process.argv[2] ?? '1', 10);
const reviewRound = [1, 2, 3].includes(requestedRound) ? requestedRound : 1;
const afterReview1 = reviewRound >= 2;
const afterReview2 = reviewRound >= 3;
const ct140Path = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request-3.json');
const targetPath = resolve(
  root,
  `docs/product/versions/v0.2.0/30-implementation/CT-141/review-request${reviewRound === 1 ? '' : `-${reviewRound}`}.json`,
);
const ct140 = JSON.parse(await readFile(ct140Path, 'utf8'));

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

const files = new Set(Object.keys(ct140.candidate.sha256));
for (const directory of [
  'apps', 'packages', 'scripts', 'ops', 'pmo', 'prototypes', 'skills',
  'docs/product/versions/v0.2.0', 'docs/operations', '.github',
]) {
  for (const path of await walk(directory)) files.add(path);
}
for (const path of [
  '.env.example', '.gitignore', '.npmrc', '.nvmrc', 'CONTRIBUTING.md', 'LICENSE',
  'README.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'firebase.json', 'firestore.rules',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts',
  'vitest.firestore.config.ts',
  '.control-tower/request-issue-get-141.json',
  '.control-tower/request-update-issue-141-runtime-audit.json',
  '.control-tower/request-update-issue-141-start.json',
  '.control-tower/request-update-issue-141-review1-dispatch.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T00-23-01-367Z-57c8c8e5-7a20-42c4-a8c5-e7054a507f9c.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T00-26-07-359Z-bf6eed63-adeb-4479-845f-9d779f405e3c.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T01-50-51-147Z-55880261-c61e-4f42-b943-33468c242673.json',
  ...(afterReview1 ? [
    '.control-tower/request-update-issue-141-review1-failure.json',
    '.control-tower/request-update-issue-141-review2-dispatch.json',
    '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-20-00-493Z-d37c793a-7cba-454f-9786-0550407d4f82.json',
    '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-30-00-957Z-9a27b1b2-4f23-4d80-a95a-5d068c185b7c.json',
  ] : []),
  ...(afterReview2 ? [
    '.control-tower/request-update-issue-141-review2-failure.json',
    '.control-tower/request-update-issue-141-review3-dispatch.json',
    '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-47-35-466Z-d69ec8e9-8cb3-4e51-8969-b0ea36c89893.json',
    '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-56-11-236Z-7888d271-ad15-43fd-b294-c27c4961928c.json',
  ] : []),
]) files.add(path);

files.delete(`docs/product/versions/v0.2.0/30-implementation/CT-141/review-request${reviewRound === 1 ? '' : `-${reviewRound}`}.json`);
files.delete('docs/product/versions/v0.2.0/30-implementation/CT-141/handoff.json');

const orderedFiles = [...files].sort();
const hashes = {};
for (const path of orderedFiles) {
  const absolute = resolve(root, path);
  if (!(await stat(absolute)).isFile()) throw new Error(`Candidate input is not a file: ${path}`);
  hashes[path] = createHash('sha256').update(await readFile(absolute)).digest('hex');
}

const unchangedDependencyInputs = [
  '.npmrc',
  'apps/api/package.json',
  'apps/web/package.json',
  'ops/cli/package.json',
  'package.json',
  'packages/config/package.json',
  'packages/contracts/package.json',
  'packages/db/package.json',
  'packages/domain/package.json',
  'packages/hosted/package.json',
  'packages/test-fixtures/package.json',
  'packages/ui/package.json',
  'prototypes/ct-4/package.json',
];
for (const path of unchangedDependencyInputs) {
  if (ct140.candidate.sha256[path] !== hashes[path]) {
    throw new Error(`Unexpected dependency-input drift from CT-140 Review 3: ${path}`);
  }
}
const changedDependencyInputs = ['apps/hosted-service/package.json', 'package-lock.json'];
const identity = (paths) => Object.fromEntries(paths.map((path) => [path, hashes[path]]));

const backups = [
  {
    kind: 'ct140_completion_dependency',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T00-23-01-367Z-57c8c8e5-7a20-42c4-a8c5-e7054a507f9c.json',
    sha256: '82100bab5827d25dd94514e15b179aff94c12eb0d893aa1a32f1e70c7a1d7387',
    raw_file_sha256: 'd4d36f6272320ef852af712ae7ca9fa85238172436e022d300e74d84f23f17b2',
  },
  {
    kind: 'start',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T00-26-07-359Z-bf6eed63-adeb-4479-845f-9d779f405e3c.json',
    sha256: '151551397093393138dd489ff6f4e0d47da69553817e7567aead1adb31a4c359',
    raw_file_sha256: '78646192b348b50e2c5064272af195505f6b40c75bc0505e0b586f4ff567fcb9',
  },
  {
    kind: 'review1_dispatch',
    path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T01-50-51-147Z-55880261-c61e-4f42-b943-33468c242673.json',
    sha256: 'dc4d0684ec497fda8e0ee7ad34b943e8e63c0449eaba4ec29c47cf6e8c2ecfde',
    raw_file_sha256: '1904cef6b45579fa7bb2fa11d4359ce1ef8a30aeb8cc03cf120ca34c156ac25c',
  },
];
if (afterReview1) {
  backups.push(
    {
      kind: 'review1_failure',
      path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-20-00-493Z-d37c793a-7cba-454f-9786-0550407d4f82.json',
      sha256: '98749d1fb69ac324538862987bf9dbd7a618912d6cc8818463b5ace139cadc4d',
      raw_file_sha256: '4f8151e27ab498e6d806c40b944582de7e5788a82a36017355eb66ebea65b1e0',
    },
    {
      kind: 'review2_dispatch',
      path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-30-00-957Z-9a27b1b2-4f23-4d80-a95a-5d068c185b7c.json',
      sha256: 'ec19bfe3126eaabbb854d716ead7ec02ca26570bb4eb60116c6acfeb12a6c6f0',
      raw_file_sha256: '49c5bab4f8eb514bc1a2db731ff5c7f591573a58f327b1d6bd82b53e1e690dbc',
    },
  );
}
if (afterReview2) {
  backups.push(
    {
      kind: 'review2_failure',
      path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-47-35-466Z-d69ec8e9-8cb3-4e51-8969-b0ea36c89893.json',
      sha256: 'ae10769f0b6b69cc55be5df219e95c7211a7698a5fb6361b76c3c4d366b57f20',
      raw_file_sha256: '3e3d63402e52f41efa92d7a458896cc3ad41f9c9575484919668cd2e559d82db',
    },
    {
      kind: 'review3_dispatch',
      path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T02-56-11-236Z-7888d271-ad15-43fd-b294-c27c4961928c.json',
      sha256: '40c52984b7f742a9a4edd3312bb86a4d6ebefd19d5d7e5e72e93fb397b41120d',
      raw_file_sha256: '2279e757893df1f5188586e08b57c092497a9514083cebe5ee14baddbc3b4750',
    },
  );
}

const now = new Date().toISOString();
const request = {
  schema_version: '1.0',
  review_type: 'independent_implementation_review',
  review_round: reviewRound,
  prepared_at: now,
  authorized_at: now,
  dispatched_at: now,
  issue: {
    identifier: 'CT-141',
    stable_id: '49f28c04-3aa9-491b-b9ed-4cd087479ce4',
    revision: reviewRound === 3 ? 9 : reviewRound === 2 ? 7 : 5,
    status: 'In Progress',
    milestone: 'S3 — Implementation',
    plan_id: 'I-209',
    requirement_refs: ['R-201', 'R-217', 'R-219'],
    test_refs: ['P-T209'],
    outcome_refs: ['O-203', 'O-204'],
  },
  authority: {
    source: 'current user standing authorization for independent-review subagents CT-134 through CT-142',
    tracking: 'project-local Control Tower v0.8 API only',
    projection: 'disabled_not_synced',
    linear_used: false,
    control_tower_ui_used: false,
    review_mode: 'strictly_read_only',
    provider_or_external_mutation_authorized: false,
    backups,
  },
  dependencies: [
    {identifier: 'CT-133', revision: 8, status: 'Done'},
    {identifier: 'CT-134', revision: 6, status: 'Done'},
    {identifier: 'CT-135', revision: 7, status: 'Done'},
    {identifier: 'CT-138', revision: 19, status: 'Done'},
    {identifier: 'CT-139', revision: 11, status: 'Done'},
    {identifier: 'CT-140', revision: 9, status: 'Done'},
  ],
  candidate: {
    summary: afterReview2
      ? 'Review 1/2 telemetry remediation plus the retained digest-bound operations candidate: strict admission-time 503/429 with exactly one event even when writeHead/end throws, no-throw post-response completion with bounded zero-duration telemetry, contained top-level rejection, pre-identity admission, bounded queries/export, authenticated budget signals, paid activation, cost/restore evidence, server-only rules, and no live/provider or excluded-scope claim.'
      : afterReview1
        ? 'Review 1 clock-regression remediation plus the retained digest-bound operations candidate: strict admission-time 503 with one event, no-throw post-response completion with bounded zero-duration telemetry, contained top-level handler rejection, pre-identity rate/abuse admission, bounded queries/export, authenticated budget signals, paid activation, cost/restore evidence, server-only rules, and no live/provider or excluded-scope claim.'
        : 'Digest-bound hosted operations policy with pre-identity rate/abuse admission, redacted admitted/rejection telemetry, bounded queries/export, authenticated budget signals, fail-closed paid activation, cost-per-seat guardrails, entire-database isolated-restore evidence, server-only rules, and provider-truth runbooks; no live/provider or excluded product scope claim.',
    intentionally_unsealed_inputs: {
      files: [
        `this Review ${reviewRound} request file and the future handoff.json`,
        '.control-tower/tasks-v0.8.sqlite3 and uncited historical backups',
        'node_modules and generated dist/coverage/emulator-log files',
        '.playwright-mcp captures, user outputs, Git internals, and unrelated historical documents not consumed by a required check',
        'live Firebase, Google Cloud, Stripe, Pub/Sub, Cloud Armor, billing-export, backup, restore, credentials, deployment, and network state',
      ],
      reason: `The request cannot hash itself and the handoff does not yet exist. The mutable CT store is attested by fresh API readback plus ${backups.length} sealed semantic/raw backups. Generated outputs derive from the sealed source/config universe. Excluded captures, outputs, unrelated documents, and live/provider state are neither candidate inputs nor authorized review targets.`,
    },
    sealed_file_count: orderedFiles.length,
    sealed_universe: [
      'the complete 445-file CT-140 Review 3 universe recomputed at current bytes',
      'every non-generated file under apps, packages, scripts, ops, pmo, prototypes, skills, docs/operations, and v0.2 product documentation',
      `root build/test/Firebase/dependency/configuration inputs, public assets/policies, CT-141 runtime/load/runbook/evidence inputs, and ${backups.length} cited semantic/raw backups`,
      'all inherited v0.1 inputs consumed by required tests through the CT-140 sealed universe',
    ],
    sha256: hashes,
  },
  audit_evidence_boundary: {
    fresh_online_audit: false,
    reason: 'The restricted command failed registry DNS and the scoped online rerun was policy-rejected because it would disclose project dependency metadata to npm. Do not retry, proxy, or circumvent this boundary.',
    accepted_evidence: [
      'npm audit --offline --omit=dev --omit=optional reports 0 vulnerabilities on the exact current lock',
      'npm ls --omit=dev --omit=optional --all exits 0 and exposes the complete supported tree',
      '13 dependency inputs are byte-identical to the accepted CT-140 Review 3 candidate',
      'apps/hosted-service/package.json and package-lock.json are new sealed CT-141 inputs; the direct exact google-auth-library dependency is already represented in the installed supported tree, but no fresh registry-audit passage is claimed',
    ],
    unchanged_ct140_review3_exact_inputs: identity(unchangedDependencyInputs),
    changed_ct141_exact_inputs: identity(changedDependencyInputs),
    complete_current_dependency_input_identity: identity(
      [...unchangedDependencyInputs, ...changedDependencyInputs].sort(),
    ),
  },
  required_checks: [
    {command: 'recompute candidate.sha256 and every cited semantic/raw backup before and after review', expected: `${orderedFiles.length}/${orderedFiles.length} exact SHA-256 entries; all ${backups.length}/${backups.length} backup pairs exact`},
    {command: 'fresh project-local v0.8 API issue-get for CT-141 and dependencies CT-133/134/135/138/139/140', expected: `CT-141 r${reviewRound === 3 ? 9 : reviewRound === 2 ? 7 : 5} In Progress on shared S3; dependencies r8/r6/r7/r19/r11/r9 Done; projection disabled/not_synced`},
    {command: `npx vitest run packages/hosted/tests/operations-control.test.ts packages/hosted/tests/operations-service.test.ts packages/hosted/tests/operations-config.test.ts packages/hosted/tests/operations-http.test.ts packages/hosted/tests/firebase-operations-repository.test.ts packages/hosted/tests/firebase-collaboration-repository.test.ts packages/hosted/tests/firebase-invitation-repository.test.ts packages/hosted/tests/firebase-billing-repository.test.ts packages/hosted/tests/project-management-service.test.ts packages/hosted/tests/collaboration-service.test.ts packages/hosted/tests/invitation-service.test.ts packages/hosted/tests/billing-service.test.ts apps/hosted-service/tests/hosted-config.test.ts apps/hosted-service/tests/google-budget-notice.test.ts apps/hosted-service/tests/operations-telemetry.test.ts${afterReview1 ? ' apps/hosted-service/tests/server-boundary.test.ts' : ''}${afterReview2 ? ' apps/hosted-service/tests/operations-admission-boundary.test.ts' : ''} --config vitest.config.ts`, expected: afterReview2 ? '17 files / 109 tests pass' : afterReview1 ? '16 files / 105 tests pass' : '15 files / 101 tests pass'},
    {command: `npm run build -w @basiclinear/hosted && npm run build -w @basiclinear/hosted-service && node scripts/tests/ct141-operations-load.mjs${afterReview1 ? ' && node scripts/tests/ct141-completion-clock.mjs' : ''}`, expected: afterReview2 ? 'original three-instance load remains exact; built completion probe closes Review 1 and returns the four exact 429/503 writeHead/end transport cases with one redacted event and no raw identifiers' : afterReview1 ? 'original three-instance load remains exact; built completion probe returns 200 plus one zero-duration event, admission regression 503 plus one event, contained top-level 503, and no raw identifiers' : 'three-instance built load passes exact 30 credential and 60 workspace per-instance stops, 90 aggregate credential ceiling, 120 configured concurrency, 4 redacted rate-limit signals, and no raw identifier'},
    {command: 'npm run test:hosted-rules', expected: '1 file / 6 groups pass under official Firestore emulator with clean shutdown; scoped loopback escalation is permitted if restricted bind returns EPERM'},
    {command: 'npm test', expected: afterReview2 ? '112 files / 711 tests pass' : afterReview1 ? '111 files / 707 tests pass' : '110 files / 703 tests pass'},
    {command: 'npm run typecheck', expected: 'all 11 workspace typecheck scripts pass'},
    {command: 'npm run build', expected: 'all builds pass; Vite transforms 1,953 local and 30 hosted modules'},
    {command: 'inspect apps/web/dist/hosted.html references', expected: 'favicon, one hosted JS, and one hosted CSS resolve 3/3; no local/editor/modulepreload coupling'},
    {command: 'npm ls --omit=dev --omit=optional --all', expected: 'exit 0 with direct @google-cloud/firestore 8.7.1 and google-auth-library 10.9.1; no direct @google-cloud/storage addition, existing firebase-admin transitive boundary remains visible'},
    {command: 'npm audit --offline --omit=dev --omit=optional and verify exact current dependency identities', expected: 'offline 0; 13 CT-140-unchanged and 2 CT-141-changed inputs exact; do not claim or retry a fresh online audit'},
    {command: 'recompute hostedOperationsPolicyDigest and parse/relate all ops/hosted templates, runbooks, environment, Firebase rewrites/rules, and package manifests', expected: 'application digest 3caa75ff...8cd5 and every runtime/limit/query/budget/cost/restore/provider-truth relation exact; all templates remain not applied'},
    {command: 'git diff --check and parse every CT-141/ops JSON file', expected: 'pass'},
    {command: 'enumerate every workspace-owned input to required tests/typecheck/build/emulator/load/evidence', expected: 'no unsealed input can alter a required result or hosted artifact'},
  ],
  adversarial_review_questions: [
    ...(afterReview1 ? [
      'Does the exact Review 1 post-response clock-regression counterexample now resolve without a rejected handler promise and with exactly one schema-valid redacted status-200 event at the admitted timestamp and zero duration? Does admission-time regression remain generic 503 with exactly one redacted failure event? Can invalid completion time, sink failure, stderr failure, synchronous/asynchronous top-level rejection, already-sent headers, response transport failure, or correlation-ID factory failure escape the containment boundary, duplicate telemetry, disclose the rejected value, or mutate application state?',
    ] : []),
    ...(afterReview2 ? [
      'Does the exact Review 2 full-handler counterexample now record one and only one redacted rejection event when either writeHead or end throws for rate-limit 429 and clock-regression 503? Across all four paths, are counters and domain state unchanged, downstream identity/provider/repository calls zero, the rejected value absent, and the top-level boundary contained without duplication? Can response getters, repeated transport throws, recordAdmissionFailure failure, or sink/stderr failure reintroduce a missing/duplicate event or unhandled rejection?',
    ] : []),
    'Does every hosted route that reaches the application handler pass operations admission before Firebase/Google/PAT/OAuth/MCP/provider authentication and before PM/repository work? Do malformed/rejected calls consume only the intended bounded bucket while credential, audit, idempotency, and domain state remain untouched?',
    'Are route classes exact for health, public invitation inspect/accept, Stripe, budget push, OAuth/discovery, MCP, REST, and hosted browser routes? Can alternate methods, encoded paths, malformed Authorization, missing workspace extraction, spoofed tracing, multiple instances, or distributed network keys bypass all applicable limits?',
    'Are candidate counters atomic under concurrency, unchanged on rejection, bounded to 20,000 buckets, pruned by window, and fail-closed on clock regression? Does the documented three-instance multiplier exactly bound application evidence without claiming a shared global counter?',
    'Do admitted and rate-limited requests produce only the exact redacted telemetry schema, with HMAC-domain separation and no raw IP, bearer, email, workspace ID, idempotency key, request body, invitation token, Google token, Stripe/provider secret, or foreign-workspace detail even on sink failure?',
    'Does the budget HTTP boundary reject duplicate headers/JSON keys, malformed or mismatched length/media/UTF-8/base64/envelope aliases, unknown fields, oversized bodies, forged OIDC issuer/audience/email/subject/time, and provider-reference mismatch before operations-ledger mutation? Are Origin and parser boundaries described without overclaim?',
    'Do duplicate identical messages remain byte/idempotency stable despite a later observedAt, divergent same-ID messages fail unchanged, older messages remain evidence without regressing current, and actual cost independently elevates severity when provider thresholds are absent or understated?',
    'Can activation, state, or signal field tamper; cross-environment/reference/review replay; stale/future time; warning/critical state; or repository outage ever reach Stripe Checkout creation? Does the second immediate policy check close a state-change race after owner authorization?',
    'Can a later activation review in the same budget interval clear or refresh a prior warning, critical, or stale state, change the budget identity, or rewind the interval? Does only a strictly later reviewed interval initialize zero/healthy state, and do old activation states/signals fail closed?',
    'Can omitted paid workspaces, duplicate source references or dimensions, inconsistent seats, non-Stripe recognized revenue, stale/future retrieval, mismatched periods, fabricated totals/digests, zero revenue, or one-microdollar-over-guardrail evidence produce an allow activation? Is production_baseline required in production and O-203 explicitly unclaimed?',
    'Do every Firestore collaboration/invitation/billing query and PM/personal-token/export caller enforce the 10,000 ceiling with limit+1, page size 100, export issue-query 5,000 and total-record 25,000 limits? Does overflow return no partial export and leave repositories unchanged?',
    'Does restore evidence require the exact complete entire-database collection inventory, whole-minute <=7-day point, isolated restore-drill destination, chronology, equal positive counts/digests, smoke/rules checks, and bounded deletion schedule? Do tamper/replay fail closed, synthetic evidence remain local-only, and production reject anything but provider_drill?',
    'Are operations/trial/OAuth/billing/private ledgers denied to direct Firestore clients, and do the Cloud Run/Armor/budget/backup templates remain exact unapplied evidence rather than live-state claims? Is Cloud Armor described only as an outer layer with ingress bypass prevention?',
    'Does the supported dependency tree retain direct Firestore and exact Google OIDC verification without adding direct Cloud Storage, concealing firebase-admin transitive packages, applying a breaking downgrade, or overstating the policy-blocked fresh online audit?',
    'Do source, built output, telemetry, evidence, templates, and documentation contain no real credential, private identifier, or prohibited AI-agent/code-review/repository/PR/operations-admin/local-cloud-sync capability?',
    `Is the ${orderedFiles.length}-file Review ${reviewRound} evidence boundary complete for every executable/imported/build/test/emulator/load/config/public-asset/documented claim, and does it remain exact after all checks?`,
  ],
  decision_contract: {
    eligible_severities: ['P0', 'P1', 'P2', 'P3'],
    pass_condition: 'All required checks and adversarial boundaries pass, the seal/backups remain exact before and after, and no reproducible P0-P3 finding remains.',
    on_fail: `Return a severity-ranked report with exact evidence and bounded remediation; CT-141 remains In Progress and must be resealed for Review ${reviewRound + 1}.`,
    on_pass: `Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review ${reviewRound} and perform a revision-checked Done update/readback.`,
    prohibited_claims: [
      'P-T209 qualified', 'O-203 succeeded', 'O-204 succeeded', 'live budget/PubSub/Cloud Armor active',
      'provider backup or restore completed', 'Firebase/Stripe/provider/deployment changed',
      'fresh online registry audit passed', 'combined release accepted', 'legal/privacy/security approved',
    ],
  },
};

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared Review ${reviewRound} ${relative(root, targetPath).split(sep).join('/')} with ${orderedFiles.length} sealed files.`);
