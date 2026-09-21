import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const outputRoot = 'docs/product/versions/v0.2.0/50-outcome-review/CT-14';
const discoveryInputsPath = `${outputRoot}/discovery-inputs.json`;
const testingInputsPath = `${outputRoot}/testing-inputs.json`;
const readinessPath = `${outputRoot}/outcome-readiness.json`;

const discoveryPaths = [
  'docs/product/versions/v0.1.0/10-discovery/discovery-package.json',
  'docs/product/versions/v0.2.0/10-discovery/discovery-package.json',
];
const discoveryPackages = discoveryPaths.map((path) => ({
  path,
  body: readFileSync(path),
}));
const outcomes = discoveryPackages.flatMap(({body}) => JSON.parse(body).outcomes);

const discoveryInputs = {
  schema_version: 'combined-discovery-outcome-inputs-v1',
  prepared_at: new Date().toISOString(),
  sources: discoveryPackages.map(({path, body}) => ({
    path,
    sha256: createHash('sha256').update(body).digest('hex'),
    outcome_ids: JSON.parse(body).outcomes.map((outcome) => outcome.id),
  })),
  outcome_count: outcomes.length,
  outcome_ids: outcomes.map((outcome) => outcome.id),
};
writeFileSync(discoveryInputsPath, `${JSON.stringify(discoveryInputs, null, 2)}\n`);

const testingInputs = {
  schema_version: 'combined-testing-readiness-inputs-v1',
  prepared_at: new Date().toISOString(),
  issue: {identifier: 'CT-14', stable_id: 'db8ccdde-b365-4cbc-b155-ba661919ba7d', revision: 4, status: 'Todo'},
  inputs: [
    {issue: 'CT-12', status: 'Done', evidence_ref: 'docs/product/versions/v0.1.0/40-testing/CT-12/result.json'},
    {issue: 'CT-142', status: 'In Progress', disposition: 'option_a_external_security_and_full_reconciliation_pending', evidence_ref: 'docs/product/versions/v0.2.0/40-testing/CT-142/option-a-handoff.json'},
    {issue: 'CT-143', status: 'Done', disposition: 'independent_production_uat_passed', evidence_ref: 'docs/product/versions/v0.2.0/40-testing/CT-143/evidence-map-final.json'},
    {issue: 'CT-3', status: 'Todo', disposition: 'qualified_review_pending', evidence_ref: 'docs/product/versions/v0.2.0/10-discovery/CT-3/combined-qualified-review-request.json'},
    {issue: 'CT-13', status: 'Todo', disposition: 'accountable_release_decision_pending', evidence_ref: 'ops/release/combined-review-preflight.json'},
  ],
  earliest_combined_review_at: '2027-02-08',
  current_readiness: 'not_ready',
  reasons: [
    'CT-142 has no full P-T210 qualification.',
    'CT-3 and CT-13 terminal human decisions are pending.',
    'All nine canonical outcome windows are future or incomplete as of preparation.',
  ],
};
writeFileSync(testingInputsPath, `${JSON.stringify(testingInputs, null, 2)}\n`);

const readiness = {
  stage: 'outcome-review.monitoring',
  status: 'awaiting_human',
  operating_profile: 'project-local-v0.8',
  authority: {
    task_store: '.control-tower/tasks-v0.8.sqlite3',
    provider_projection: 'disabled_not_synced',
    linear_used: false,
  },
  testing_handoff_ref: testingInputsPath,
  discovery_contract_ref: discoveryInputsPath,
  discovery_outcomes: outcomes,
  reviews: outcomes.map((outcome) => ({
    outcome_id: outcome.id,
    contract_sha256: outcome.contract_sha256,
    original_contract: outcome,
    window_complete: false,
    baseline_direction_met: false,
    target_met: false,
    guardrail_results: [],
    invalidation_triggered: false,
    status: 'pending',
    evidence_refs: [],
  })),
  human_decision: {
    required: true,
    status: 'pending',
  },
};
writeFileSync(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`);

console.log(JSON.stringify({
  prepared: true,
  outcome_count: outcomes.length,
  outcome_ids: outcomes.map((outcome) => outcome.id),
  earliest_combined_review_at: testingInputs.earliest_combined_review_at,
  outputs: [discoveryInputsPath, testingInputsPath, readinessPath],
}, null, 2));
