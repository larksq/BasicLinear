import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const outputPath = 'ops/release/combined-review-preflight.json';
const receiptPath = `${outputPath}.sha256`;
const evidencePaths = [
  'docs/product/versions/v0.1.0/40-testing/CT-12/result.json',
  'docs/product/versions/v0.2.0/10-discovery/CT-3/combined-qualified-review-request.json',
  'docs/product/versions/v0.2.0/10-discovery/CT-3/combined-qualified-review-request.json.sha256',
  'docs/product/versions/v0.2.0/20-planning/ct142-security-skip-resolution-options.md',
  'docs/product/versions/v0.2.0/20-planning/ct142-security-skip-sponsor-decision.json',
  'docs/product/versions/v0.2.0/20-planning/ct142-security-skip-sponsor-decision.template.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/result.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/sponsor-security-skip.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/option-a-handoff.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/external-security-review-request.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/external-security-review-request.json.sha256',
  'docs/product/versions/v0.2.0/40-testing/CT-142/external-security-result.template.json',
  'docs/product/versions/v0.2.0/40-testing/CT-142/external-security-result.template.json.sha256',
  'docs/product/versions/v0.2.0/40-testing/CT-143/evidence-map.json',
  'docs/product/versions/v0.2.0/40-testing/CT-143/evidence-map-final.json',
  'docs/product/versions/v0.2.0/40-testing/CT-143/production-uat-review-1.json',
  'docs/product/versions/v0.2.0/40-testing/CT-143/review-2.md',
  'docs/product/versions/v0.2.0/40-testing/CT-143/decision.md',
  'docs/product/versions/v0.2.0/40-testing/CT-143/result.json',
  'docs/product/versions/v0.2.0/40-testing/CT-143/control-tower-reconciliation.json',
  'docs/product/versions/v0.2.0/40-testing/CT-143/candidate.sha256',
  'docs/product/versions/v0.2.0/50-outcome-review/CT-14/outcome-readiness.json',
  'docs/product/versions/v0.2.0/50-outcome-review/CT-14/testing-inputs.json',
  'docs/product/versions/v0.2.0/completion-audit-2026-08-27.md',
  'ops/hosted/environments/development.json',
  'ops/hosted/environments/production.json',
  'ops/release/asset-provenance.json',
  'ops/release/copy-provenance.json',
  'ops/release/dependency-license-inventory.json',
  'ops/release/third-party-notices.json',
  'design-qa.md',
];

const evidence = evidencePaths.sort().map((path) => {
  const body = readFileSync(path);
  return {path, sha256: createHash('sha256').update(body).digest('hex')};
});
const evidenceSetSha256 = createHash('sha256')
  .update(evidence.map(({path, sha256}) => `${sha256}  ${path}`).join('\n'))
  .digest('hex');

const preflight = {
  schema_version: 'combined-release-review-preflight-v1',
  prepared_at: new Date().toISOString(),
  issue: {
    identifier: 'CT-13',
    stable_id: '7ac28514-97fb-43e3-aabc-7c12c01129f7',
    expected_revision: 126,
    expected_status: 'Todo',
    expected_milestone: 'S5 — Outcome Review',
  },
  candidate: {
    product: 'combined OpenLinear v0.1 local + v0.2 hosted',
    evidence_file_count: evidence.length,
    evidence_set_sha256: evidenceSetSha256,
    ct143_file_count: 573,
    ct143_aggregate_sha256: '1e4b7c6d633a2feee7f0a2644a3f998002aab0bf42da9bb739a4eab66b8b47a9',
  },
  disposition: 'hold_dependencies_incomplete',
  gates: [
    {id: 'CT-3-qualified-boundary', status: 'BLOCKED', evidence_ref: 'docs/product/versions/v0.2.0/10-discovery/CT-3/combined-qualified-review-request.json', reason: 'A real qualified acceptance has not been recorded.'},
    {id: 'CT-12-local-integrated-testing', status: 'PASS', evidence_ref: 'docs/product/versions/v0.1.0/40-testing/CT-12/result.json'},
    {id: 'CT-142-hosted-integrated-testing', status: 'BLOCKED', evidence_ref: 'docs/product/versions/v0.2.0/40-testing/CT-142/external-security-review-request.json', reason: 'Sponsor selected Option A; the exact external-review handoff is prepared, but signed R-204/R-219 evidence and full P-T210 reconciliation remain absent.'},
    {id: 'CT-143-deployed-workspace-UAT', status: 'PASS', evidence_ref: 'docs/product/versions/v0.2.0/40-testing/CT-143/evidence-map-final.json', reason: 'Independent production-first real-data UAT passed after one P3 stale-session finding was remediated and independently closed; CT-143 is revision 8 Done.'},
    {id: 'development-production-separation', status: 'PASS', evidence_ref: 'ops/hosted/environments/development.json'},
    {id: 'no-charge-verification-boundary', status: 'PASS_BOUNDED', evidence_ref: 'ops/hosted/environments/production.json', reason: 'Verification access is proven; payment execution is intentionally not claimed.'},
    {id: 'design-QA', status: 'PASS', evidence_ref: 'design-qa.md'},
    {id: 'outcomes', status: 'PENDING', evidence_ref: 'docs/product/versions/v0.2.0/50-outcome-review/CT-14/outcome-readiness.json', reason: 'Technical readiness is not outcome proof and all canonical windows remain pending.'},
  ],
  accountable_decision: {
    status: 'not_requestable_yet',
    reason: 'CT-3 and CT-142 terminal dependencies are incomplete.',
    allowed_future_decisions: ['accept', 'reject', 'bounded_remediation'],
    self_approval_prohibited: true,
  },
  rollback_and_operations: {
    development_url: 'https://openlinear-development.vercel.app',
    production_url: 'https://openlinear-gray.vercel.app',
    production_delete_protection: true,
    stripe_connected: false,
    checkout_enabled: false,
    public_payment_activation_allowed: false,
  },
  evidence,
  prohibited_claims: [
    'combined release accepted',
    'public billing active',
    'security qualification',
    'legal or privacy approval',
    'validated outcomes',
    'retrospective complete',
  ],
};

const body = `${JSON.stringify(preflight, null, 2)}\n`;
writeFileSync(outputPath, body);
const sha256 = createHash('sha256').update(body).digest('hex');
writeFileSync(receiptPath, `${sha256}  ${outputPath}\n`);
console.log(JSON.stringify({
  prepared: true,
  disposition: preflight.disposition,
  evidence_file_count: evidence.length,
  evidence_set_sha256: evidenceSetSha256,
  preflight_sha256: sha256,
}, null, 2));
