import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const priorRequestPath = 'docs/product/versions/v0.2.0/30-implementation/CT-141/review-request-3.json';
const requestPath = 'docs/product/versions/v0.2.0/40-testing/CT-142/review-request.json';

const additions = [
  '.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T03-25-29-517Z-8735c1f5-e7ce-48d5-a9ac-a7b32fb63d62.json',
  '.control-tower/request-issue-get-142.json',
  '.control-tower/request-update-issue-142-start.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-134/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-135/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-136/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-137/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-138/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-139/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-140/handoff.json',
  'docs/product/versions/v0.2.0/30-implementation/CT-141/handoff.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/automated-receipt.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/evidence-map.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/evidence.md',
  'docs/product/versions/v0.2.0/40-testing/CT-142/implementation-inputs.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/manual-observation.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/result.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/session.md',
  'docs/product/versions/v0.2.0/40-testing/CT-142/sponsor-security-skip.json',
  'packages/hosted/tests/ct142-nonsecurity-journey.test.ts',
  'scripts/prepare-ct142-review1.mjs',
  'scripts/tests/ct142-nonsecurity-gates.mjs',
];

const prior = JSON.parse(readFileSync(priorRequestPath, 'utf8'));
const request = JSON.parse(readFileSync(requestPath, 'utf8'));
const paths = [...new Set([...Object.keys(prior.candidate.sha256), ...additions])].sort();
const sha256 = Object.fromEntries(paths.map((path) => [
  path,
  createHash('sha256').update(readFileSync(path)).digest('hex'),
]));

request.candidate = {
  sealed_file_count: paths.length,
  sealed_universe: 'The exact CT-141 Review 3 source/build/test/evidence universe, rehashed at dispatch, plus accepted implementation handoffs and CT-142 nonsecurity evidence inputs.',
  summary: 'Provider-free nonsecurity integrated acceptance candidate. Hashing an inherited file does not authorize security review of it.',
  intentionally_unsealed_inputs: [
    '.git/**',
    '.control-tower/tasks-v0.8.sqlite3',
    'node_modules/**',
    '**/dist/**',
    'docs/product/versions/v0.2.0/40-testing/CT-142/review-request.json (self-referential dispatch envelope)',
    'docs/product/versions/v0.2.0/40-testing/CT-142/decision.md (review output, not yet created)',
    'docs/product/versions/v0.2.0/40-testing/CT-142/review.md (review output, not yet created)',
    'docs/product/versions/v0.2.0/40-testing/CT-142/handoff.json (post-review output, not yet created)'
  ],
  sha256,
};

writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
console.log(JSON.stringify({prepared: true, sealed_file_count: paths.length}, null, 2));
