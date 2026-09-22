import {createHash} from 'node:crypto';
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';

const root = process.cwd();
const previousPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-4.json');
const targetPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-140/review-request.json');
const previous = JSON.parse(await readFile(previousPath, 'utf8'));

const excludedSegments = new Set([
  'node_modules', 'dist', 'coverage', '.git', '.playwright-mcp', '.firebase',
]);
const excludedNames = new Set([
  'firestore-debug.log', 'firebase-debug.log', '.DS_Store',
]);

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

const files = new Set(Object.keys(previous.candidate.sha256));
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
  '.control-tower/request-update-issue-139-done.json',
  '.control-tower/request-update-issue-140-start.json',
  '.control-tower/request-update-issue-140-review1-dispatch.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T21-10-02-655Z-dfbed8f8-28d6-4100-a473-98343e50fa05.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T21-12-19-373Z-5aa871d7-af11-4c03-9c5f-b236c5526fb4.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T22-41-42-337Z-25c273f2-4539-443b-bd1e-8707e3996f31.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-4.json',
]) files.add(path);

files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/review-request.json');
files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/review.md');
files.delete('docs/product/versions/v0.2.0/30-implementation/CT-140/handoff.json');

const orderedFiles = [...files].sort();
const hashes = {};
for (const path of orderedFiles) {
  const absolute = resolve(root, path);
  if (!(await stat(absolute)).isFile()) throw new Error(`Candidate input is not a file: ${path}`);
  hashes[path] = createHash('sha256').update(await readFile(absolute)).digest('hex');
}

const request = {
  schema_version: '1.0',
  stage: 'implementation.independent-review-request',
  status: 'dispatched',
  review_round: 1,
  prepared_at: '2026-08-25T22:43:00.000Z',
  authorized_at: '2026-08-25T22:43:00.000Z',
  dispatched_at: '2026-08-25T22:43:00.000Z',
  authorization: {
    authorized_by: 'user',
    scope: ['CT-134', 'CT-135', 'CT-136', 'CT-137', 'CT-138', 'CT-139', 'CT-140', 'CT-141', 'CT-142'],
    standing: true,
  },
  issue: {
    identifier: 'CT-140',
    stable_id: '0be25639-46be-4a49-aea6-5c3422b1ffb0',
    revision: 4,
    status: 'In Progress',
    milestone: 'S3 — Implementation',
    plan_id: 'I-208',
    requirements: ['R-213', 'R-214', 'R-215', 'R-219', 'R-220'],
    acceptance: ['P-T208'],
    outcomes: ['O-204'],
  },
  authority: {
    profile: 'project-local-v0.8',
    task_store: '.control-tower/tasks-v0.8.sqlite3',
    projection: 'disabled_not_synced',
    dependencies: [{identifier: 'CT-139', status: 'Done', revision: 11}],
    backup_checksum_note: "Each sha256 is the export package's embedded semantic checksum; raw_file_sha256 hashes the serialized JSON bytes.",
    backups: [
      {
        kind: 'ct139_completion_dependency',
        path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T21-10-02-655Z-dfbed8f8-28d6-4100-a473-98343e50fa05.json',
        sha256: '785f1c074d6a82ecf043ac2d7196c50a7fbc8bd5f1a009947d6411bb6f1a8b00',
        raw_file_sha256: 'b314da973b22d0b1e310eed1da32520359231f1b340930075ac3687400143188',
      },
      {
        kind: 'start',
        path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T21-12-19-373Z-5aa871d7-af11-4c03-9c5f-b236c5526fb4.json',
        sha256: 'a52bce8cb977b2521f32ad94fcb23d9eddf81eab5d25aa460c3d4ed4ba233423',
        raw_file_sha256: '1fd72024d1c47754bce400e19225693d9702e049c88801337ed5a35c3ca371d4',
      },
      {
        kind: 'review1_dispatch',
        path: '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T22-41-42-337Z-25c273f2-4539-443b-bd1e-8707e3996f31.json',
        sha256: '0d49c26f5e3194c6e90f09ead207a58b2c91c6e9c2cf00272e9c85c099c5df13',
        raw_file_sha256: 'c3a9e8bf79b97887546df855a97c5168c2925cbda85001c1ad228c052061a2a3',
      },
    ],
  },
  independence: {
    required: true,
    primary_actor_id: 'codex-primary',
    reviewer_actor_id: 'ct140-independent-review',
    reviewer_must_be_distinct: true,
    mode: 'read_only',
    prohibited_actions: [
      'editing any file',
      'mutating Control Tower',
      'creating a commit',
      'changing Firebase, Stripe, OAuth clients, deployment, or other external state',
    ],
    dispatch_state: 'dispatched',
  },
  candidate: {
    summary: 'Stable 2026-07-28 stateless PM-only MCP, exact OAuth/PKCE/consent and signed token-family lifecycle, shared-service parity, explicit hosted consent UX, direct-Firestore ledger denial, and validated basiclinear-product-management skill; all agent/code-review/repository/PR/token-admin/billing-purchase capabilities remain absent.',
    intentionally_unsealed_inputs: {
      files: [
        'this Review 1 request file and the future reviewer-authored review.md/handoff.json',
        '.control-tower/tasks-v0.8.sqlite3 and uncited historical backups',
        'node_modules and generated dist/coverage/emulator-log files',
        '.playwright-mcp captures, user outputs, Git internals, and unrelated historical documents not consumed by a required check',
        'live Firebase/Stripe/OAuth resources, credentials, deployment state, and network services',
      ],
      reason: 'The request cannot hash itself and review outputs do not yet exist. The mutable CT store is attested by fresh API readback plus three sealed semantic/raw backups. Generated outputs derive from the sealed source/config universe. Excluded captures, outputs, unrelated documents, and live/provider state are not candidate inputs and are not authorized for mutation.',
    },
    sealed_file_count: orderedFiles.length,
    sealed_universe: [
      'the complete CT-139 Review 4 input universe, recomputed at current bytes',
      'every non-generated file under apps, packages, scripts, ops, pmo, prototypes, and the packaged skill',
      'every v0.2 discovery/planning/implementation file plus inherited v0.1 files consumed by required tests',
      'root build/test/Firebase/dependency/configuration, public assets/policies, CT-140 evidence/generator files, and three cited semantic/raw backups',
    ],
    sha256: hashes,
  },
  audit_evidence_boundary: {
    fresh_online_audit: false,
    reason: 'The restricted audit failed registry DNS and the scoped online rerun was policy-rejected because it would disclose dependency metadata to npm. Do not retry or circumvent that policy boundary.',
    accepted_evidence: [
      'npm audit --offline --omit=dev --omit=optional reports 0 vulnerabilities',
      'npm ls --omit=dev --omit=optional --all exits 0',
      'all 14 package manifests/lock inputs are byte-identical to CT-139 Review 4 and the independently registry-audited CT-138 Review 8 boundary',
    ],
    exact_input_identity: Object.fromEntries(Object.entries(hashes).filter(([path]) => (
      path === 'package.json' || path === 'package-lock.json' || path.endsWith('/package.json')
    ))),
  },
  required_checks: [
    {command: 'recompute candidate.sha256 and every cited semantic/raw backup before and after review', expected: `${orderedFiles.length}/${orderedFiles.length} exact SHA-256 entries; all 3/3 backup pairs exact`},
    {command: 'fresh project-local v0.8 API issue-get for CT-140 and CT-139', expected: 'CT-140 r4 In Progress on shared S3; CT-139 r11 Done; projection disabled/not_synced'},
    {command: 'npx vitest run packages/hosted/tests/mcp-oauth-service.test.ts packages/hosted/tests/mcp-server.test.ts packages/hosted/tests/automation-http.test.ts packages/hosted/tests/mcp-skill.test.ts apps/web/tests/hosted-mcp-consent.test.ts', expected: '5 files / 20 tests pass'},
    {command: 'npm run test:hosted-rules', expected: '1 file / 6 groups pass under official Firestore emulator with clean shutdown; scoped loopback escalation is permitted if the restricted bind returns EPERM'},
    {command: 'npm test', expected: '103 files / 675 tests pass'},
    {command: 'npm run typecheck', expected: 'all 11 workspace typecheck scripts pass'},
    {command: 'npm run build', expected: 'all builds pass; Vite transforms 1,953 local and 30 hosted modules'},
    {command: 'inspect apps/web/dist/hosted.html references', expected: 'favicon, one hosted JS, and one hosted CSS resolve 3/3; no local/editor/modulepreload coupling'},
    {command: 'npm ls --omit=dev --omit=optional --all', expected: 'exit 0 with the supported direct Firestore runtime'},
    {command: 'run packaged skill quick_validate with the available PyYAML runtime', expected: 'Skill is valid!'},
    {command: 'npm audit --offline --omit=dev --omit=optional and verify audit_evidence_boundary exact hashes', expected: 'offline 0; all 14 dependency inputs exact; do not claim or retry a fresh online audit'},
    {command: 'git diff --check and parse every CT-140 JSON file', expected: 'pass'},
    {command: 'enumerate every workspace-owned input to required tests/typecheck/build/skill/emulator/evidence', expected: 'no unsealed input can alter a required result or hosted artifact'},
  ],
  adversarial_review_questions: [
    'Does the implementation match stable MCP 2026-07-28 rather than an older initialize/session/GET-event profile: one POST per request, no session identifier, no GET stream, mandatory server/discover, JSON or request-scoped SSE, and pre-work close cancellation?',
    'Do malformed/duplicate/missing Content-Type, Content-Length, Accept, Authorization, MCP protocol/method/name/workspace headers, invalid UTF-8/JSON/metadata/capabilities/clientInfo, notifications, unknown methods, mismatches, aligned unsupported versions, and oversized bodies fail with the exact HTTP/JSON-RPC boundary before identity, token, or PM state changes?',
    'Are server/discover, tools/list, and tools/call results schema-valid with resultType complete, current serverInfo, JSON Schema 2020-12 definitions, conforming structuredContent plus compatibility text, safe application errors, and exact private/public cache semantics?',
    'Do DCR and authorization reject normalized redirect aliases, duplicate or unsafe redirects, unsupported client/grant/response modes, query duplication, resource/workspace/state/scope/PKCE errors, consent by a foreign/removed/wrong-role user, expired/future/tampered records, and all cross-record identity/scope/resource/chronology mismatches without secret disclosure or partial state?',
    'Are allow and deny explicit, account-switch recovery usable, exact client/redirect/workspace/scopes/account/expiry visible, state and issuer returned exactly, codes one-time and five-minute, access tokens exactly ten-minute, and families exactly thirty-day?',
    'Does refresh rotate, permit only downscope, revoke the whole family on reuse, deny at the final unusable-time boundary, fail closed for current/superseded/revoked/used or cross-bound token records, and keep same/different replay snapshots and secrets safe?',
    'Do membership removal, reactivation with a new revision, role change, future lifecycle times, missing/malformed workspace or membership, explicit revoke, and clock regression deny access/refresh/replay immediately while still allowing safe revocation where appropriate?',
    'Does every protected tool request authenticate an audience-bound MCP token, reread current membership and shared authorization in the application service, reject REST PATs/token passthrough and foreign workspace mirrors, return correct 401/403 challenges, and avoid forwarding credentials downstream?',
    'Are exactly 27 PM tools exposed, with correct OAuth scope, input/output schema, annotations, idempotency/revision/owner semantics, deterministic reads, source=mcp audit parity, and no billing purchase, token admin, agent, code-review, repository, PR, arbitrary-data, or synchronization capability?',
    'Can all 27 tool paths be exercised or structurally traced to the same CT-136-through-CT-139 services, including invitation one-response secret behavior, assignment/member/billing owner boundaries, mutation conflict/replay behavior, and redacted failures?',
    'Does exact Origin rejection occur before OAuth/MCP/identity work; are all seven OAuth collections server-only in Firestore; and do source, built output, errors, audits, logs, docs, skill, and candidate evidence contain no raw credential, token family secret, invitation digest, provider secret, or foreign-workspace disclosure?',
    'Does the packaged skill validate, name the exact 27 tools/scopes, require explicit workspace/read-first/revision/idempotency safety, require fresh confirmation for comment.delete/member.remove/invitation.revoke, protect invitation links, and prohibit the excluded product surface?',
    `Is the ${orderedFiles.length}-file evidence boundary complete for every executable/imported/build/test/emulator/skill/config/public-asset/documented claim, and does it remain exact after all checks?`,
  ],
  decision_contract: {
    severity_scale: ['P0', 'P1', 'P2', 'P3'],
    pass_requires: [
      'all required checks pass or an explicitly accepted environmental limitation is reported without overclaim',
      'all candidate and backup hashes match before and after',
      'no P0, P1, P2, or P3 finding remains',
      'no prohibited claim or excluded product capability is present',
    ],
    on_fail: 'Return a severity-ranked report with exact evidence and bounded remediation; CT-140 remains In Progress and must be resealed for Review 2.',
    on_pass: 'Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review 1 and perform a revision-checked Done update/readback.',
  },
  prohibited_claims: [
    'P-T208 qualified',
    'O-204 succeeded',
    'public MCP or OAuth is active',
    'Firebase/Stripe/provider/deployment state was changed',
    'fresh online registry audit passed',
    'combined release accepted',
    'legal, privacy, or security approval',
  ],
};

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared ${relative(root, targetPath).split(sep).join('/')} with ${orderedFiles.length} sealed files.`);
