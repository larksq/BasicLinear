import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sourcePath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-3.json');
const targetPath = resolve(root, 'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-4.json');
const request = JSON.parse(await readFile(sourcePath, 'utf8'));
const now = new Date().toISOString();

const additions = [
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-37-41-568Z-ef8ce716-a06b-489a-bbcd-34a07eafa820.json',
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-41-59-283Z-7c40fec5-6376-43e8-a9fc-b66f59841f6a.json',
  '.control-tower/request-update-issue-139-review3-failure.json',
  '.control-tower/request-update-issue-139-review4-dispatch.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-139/review-request-3.json',
  'scripts/prepare-ct139-review4.mjs',
];
const files = [...new Set([...Object.keys(request.candidate.sha256), ...additions])].sort();
const hashes = {};
for (const path of files) {
  hashes[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
}

request.review_round = 4;
request.prepared_at = now;
request.authorized_at = now;
request.dispatched_at = now;
request.issue.revision = 10;
request.authority.backups.push(
  {
    kind: 'review3_failure',
    path: additions[0],
    sha256: 'fa37d5b9a979214d8f387bb84fbd6b7802601ea8317eabf3a17274b94c46ff2f',
    raw_file_sha256: '7268a1919eadc9507014f4989d1741251b3440dc99db8fe12d731230482d193e',
  },
  {
    kind: 'review4_dispatch',
    path: additions[1],
    sha256: '354e18a6685c4104ca9ef6aa6f4bcd7ca0acfb1379f8274c5bf8df3ff874e9fd',
    raw_file_sha256: '4f4aa5ed38a909faa3ee07376901ff6a097f1ea4e1f494ff672ed3ef9399c506',
  },
);
request.candidate.summary = 'Review 1/2/3-remediated PM-only REST v1 with zero-byte and all malformed mutation framing rejected before credential use, parser-safe errors, exact personal-token lifecycle, canonical referentially complete export, canonical Firestore schema/date/chronology boundaries, and recoverable owner web controls; MCP/OAuth and all prohibited product capabilities remain absent.';
request.candidate.intentionally_unsealed_inputs.files[0] = 'this Review 4 request file';
request.candidate.intentionally_unsealed_inputs.reason = 'The request cannot hash itself; the mutable CT store is attested by fresh API readback plus nine sealed semantic/raw backups; generated artifacts derive from the sealed build/config/source universe; excluded captures, outputs, historical documents, and live/provider state are not candidate inputs and are not authorized for mutation.';
request.candidate.sealed_file_count = files.length;
request.candidate.sealed_universe[2] = 'root build/test/Firebase/dependency/configuration and public policy files, including the Review 3 and Review 4 seal generators';
request.candidate.sealed_universe[3] = 'all CT-139 API request/review evidence and nine cited semantic/raw backups';
request.candidate.sha256 = hashes;

for (const path of Object.keys(request.audit_evidence_boundary.exact_input_identity)) {
  request.audit_evidence_boundary.exact_input_identity[path] = hashes[path];
}
request.required_checks[0].expected = `${files.length}/${files.length} exact SHA-256 entries before and after; all nine semantic/raw backup pairs exact`;
request.required_checks[1].expected = 'CT-139 revision 10 In Progress on shared S3; CT-135 r7, CT-137 r9, CT-138 r19 Done; projection disabled/not_synced';
request.required_checks[2].expected = '10 files / 87 tests pass';
request.required_checks[4].expected = '99 files / 657 tests pass';
request.required_checks[10].expected = 'all 100 files exercised by npm test (99) or the separately configured emulator suite (1), every additional workspace-owned test-like file, every one of the 11 workspace package manifests and tsconfigs, every build script/config/public asset/runtime source, and every cited evidence/generator file are present in the seal; no unsealed workspace-owned input can alter a required result or hosted artifact';

request.adversarial_review_questions = [
  'Review 3 zero-byte closure: against actual PersonalTokenService and repository state, does every declared POST/PATCH/PUT/DELETE mutation reject a zero-byte required body before credential use, leaving the PAT record, token.use audits, idempotency records, and PM entities byte-for-byte unchanged, while exact JSON bodies including required {} actions still work?',
  ...request.adversarial_review_questions.map((question) => question
    .replaceAll('403-file', `${files.length}-file`)
    .replaceAll('403/403', `${files.length}/${files.length}`)
    .replaceAll('seven semantic/raw', 'nine semantic/raw')
    .replaceAll('Review 3', 'Review 4')),
];
request.decision_contract.on_fail = 'Return a severity-ranked report with exact evidence and bounded remediation; CT-139 remains In Progress and must be resealed for Review 5.';
request.decision_contract.on_pass = 'Return a formal PASS with severity totals. Do not mutate CT; the primary agent may record Review 4 and perform a revision-checked Done update/readback.';

await writeFile(targetPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
console.log(`Prepared ${targetPath} with ${files.length} sealed files.`);
