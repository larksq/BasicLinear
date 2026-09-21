import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sourcePath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-2.json');
const targetPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-3.json');
const request = JSON.parse(await readFile(sourcePath, 'utf8'));
const now = new Date().toISOString();

const additions = [
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-04-32-284Z-539dd5b2-e4b8-4166-9805-e5bc025a1f4b.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-19-59-448Z-596f5cc1-da8a-4fda-8cb5-5485c389c9a5.json',
  '.control-tower/request-update-issue-139-review2-failure.json',
  '.control-tower/request-update-issue-139-review3-dispatch.json',
  'apps/hosted-service/src/client-error.ts',
  'apps/hosted-service/tests/client-error.test.ts',
  'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-2.json',
  'scripts/prepare-ct139-review3.mjs',
];
const files = [...new Set([...Object.keys(request.candidate.sha256), ...additions])].sort();
const hashes = {};
for (const path of files) {
  hashes[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
}

request.review_round = 3;
request.prepared_at = now;
request.authorized_at = now;
request.dispatched_at = now;
request.issue.revision = 8;
request.authority.backups.push(
  {
    kind: 'review2_failure',
    path: additions[0],
    sha256: '54a9e055958910f3c3bf100c85d2c2b5aaea2b3ecd91ad47baec690a3adf8312',
    raw_file_sha256: '827f88dae6ccaa3a1aa1e20b48cce669e38b1fd3867f60ae29f75c5be7936c06',
  },
  {
    kind: 'review3_dispatch',
    path: additions[1],
    sha256: 'c2b9b7888c248dbce684828cf4c636649f5b1a65dec747bc2660ab2ddbbc0712',
    raw_file_sha256: '25f3737d25365a2b0bbbf435b0e83f77dfca1977783d986b0395b6ed1da7fc3b',
  },
);
request.candidate.summary = 'Review 1/2-remediated PM-only REST v1 with pre-credential mutation framing, parser-safe errors, exact personal-token lifecycle, canonical referentially complete export, canonical Firestore schema/date/chronology boundaries, and recoverable owner web controls; MCP/OAuth and all prohibited product capabilities remain absent.';
request.candidate.intentionally_unsealed_inputs.files[0] = 'this Review 3 request file';
request.candidate.intentionally_unsealed_inputs.reason = 'The request cannot hash itself; the mutable CT store is attested by fresh API readback plus seven sealed semantic/raw backups; generated artifacts derive from the sealed build/config/source universe; excluded captures, outputs, historical documents, and live/provider state are not candidate inputs and are not authorized for mutation.';
request.candidate.sealed_file_count = files.length;
request.candidate.sealed_universe[2] = 'root build/test/Firebase/dependency/configuration and public policy files, including the Review 3 seal generator';
request.candidate.sealed_universe[3] = 'all CT-139 API request/review evidence and seven cited semantic/raw backups';
request.candidate.sha256 = hashes;

for (const path of Object.keys(request.audit_evidence_boundary.exact_input_identity)) {
  request.audit_evidence_boundary.exact_input_identity[path] = hashes[path];
}
request.required_checks[0].expected = `${files.length}/${files.length} exact SHA-256 entries before and after; all seven semantic/raw backup pairs exact`;
request.required_checks[1].expected = 'CT-139 revision 8 In Progress on shared S3; CT-135 r7, CT-137 r9, CT-138 r19 Done; projection disabled/not_synced';
request.required_checks[2].command = 'npx vitest run packages/hosted/tests/project-management-service.test.ts packages/hosted/tests/personal-token-service.test.ts packages/hosted/tests/rest-api.test.ts packages/hosted/tests/automation-http.test.ts packages/hosted/tests/collaboration-service.test.ts packages/hosted/tests/invitation-service.test.ts packages/hosted/tests/billing-service.test.ts apps/hosted-service/tests/hosted-config.test.ts apps/hosted-service/tests/client-error.test.ts apps/web/tests/hosted-automation.test.ts';
request.required_checks[2].expected = '10 files / 86 tests pass';
request.required_checks[4].expected = '99 files / 656 tests pass';
request.required_checks[10].expected = 'all 100 files exercised by npm test (99) or the separately configured emulator suite (1), every additional workspace-owned test-like file, every one of the 11 workspace package manifests and tsconfigs, every build script/config/public asset/runtime source, and every cited evidence/generator file are present in the seal; no unsealed workspace-owned input can alter a required result or hosted artifact';

request.adversarial_review_questions = [
  'Review 2 Firestore closure: using the official emulator, do extra-field or noncanonical-timestamp memberships deny authorization, and do extra-field workspace plus malformed-ID/text/timestamp/chronology project/milestone records and impossible/leap target dates fail closed while exact valid records remain readable?',
  'Review 2 PUT/media closure: does every declared POST/PATCH/PUT/DELETE mutation reject missing, duplicate, or unsupported JSON media before token use, especially PUT issue assignment?',
  'Review 2 pre-auth framing closure: against actual token state, do duplicate/invalid idempotency and revision headers, malformed JSON, declared or streamed oversize bodies, duplicate content headers, and all other applicable framing failures leave the PAT record, token.use audits, idempotency, and PM state byte-for-byte unchanged?',
  'Review 2 query-code closure: do duplicate cursor or limit keys on every collection GET return INVALID_CURSOR, while unknown entity/collection/action/mutation/OpenAPI query keys return INVALID_REQUEST before token use?',
  'Review 2 parser-error closure: using a real Node TCP request with duplicate Content-Length and other parser failures, does the compiled server return a redacted correlated JSON error with exact length, Connection close, no-store, and nosniff without echoing request/header input?',
  ...request.adversarial_review_questions.map((question) => question
    .replaceAll('395-file', `${files.length}-file`)
    .replaceAll('395/395', `${files.length}/${files.length}`)
    .replaceAll('98 full-suite files', '99 full-suite files')),
];
request.decision_contract.on_fail = 'Return a severity-ranked report with exact evidence and bounded remediation; CT-139 remains In Progress and must be resealed for Review 4.';
request.decision_contract.on_pass = 'Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review 3 and perform a revision-checked Done update/readback.';

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared ${targetPath} with ${files.length} sealed files.`);
