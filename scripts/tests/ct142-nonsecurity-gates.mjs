import {spawnSync} from 'node:child_process';

const groups = [
  {
    id: 'integrated-journey',
    files: ['packages/hosted/tests/ct142-nonsecurity-journey.test.ts'],
    names: 'completes the synthetic owner/member collaboration, paid plan, and Free downgrade path',
  },
  {
    id: 'core-positive-paths',
    files: [
      'packages/hosted/tests/owner-bootstrap.test.ts',
      'packages/hosted/tests/invitation-service.test.ts',
      'packages/hosted/tests/collaboration-service.test.ts',
      'packages/hosted/tests/billing-service.test.ts',
    ],
    names: [
      'creates exactly one owner workspace, membership, and 30-day trial across concurrent tabs',
      'never grants a second trial when the same UID returns later with a new retry key',
      'commits the Firebase document set atomically and reuses it on a concurrent retry',
      'creates one retry-safe email-bound invitation without counting a pending seat',
      'converges concurrent correct acceptances on one membership and one first-acceptance event',
      'reactivates a removed exact-workspace member atomically and only once',
      'creates and lists a task with retry-safe idempotency and privacy-safe evidence',
      'lets the assigned member update allowed fields with optimistic conflicts and emits the O-202 action',
      'keeps comment author and creation time immutable through edit and soft delete',
      'reports exact server-owned totals, trial dates, active seats, and non-seat pending invitations',
      'creates and replays checkout from trusted price and active-seat state only',
      'retrieves current subscription state, reconciles server seats with explicit proration, and deduplicates notices',
      'uses the exact trial boundary and leaves one owner writer on Free',
    ].join('|'),
  },
  {
    id: 'automation-positive-paths',
    files: [
      'packages/hosted/tests/rest-api.test.ts',
      'packages/hosted/tests/mcp-server.test.ts',
      'packages/hosted/tests/personal-token-service.test.ts',
      'packages/hosted/tests/project-management-service.test.ts',
    ],
    names: [
      'publishes an exact OpenAPI 3.1.1 contract with no excluded product routes',
      'returns a canonical export without revealing the token or private server ledgers',
      'completes the public-client HTTP registration, PKCE consent, token, refresh, and revoke flow',
      'lists exactly the scoped PM allowlist and calls the shared service over request-scoped SSE',
      'preserves reciprocal REST/MCP state, retry, revision-conflict, and audit semantics',
      'shows a scoped credential once, stores only its digest, and updates last-use state',
      'revokes immediately, replays safely, and returns a stable not-found response',
      'creates and revises projects and milestones with retry, audit, and stale-revision safety',
      'exports one canonical workspace snapshot without credentials, billing internals, or foreign data',
    ].join('|'),
  },
  {
    id: 'web-positive-paths',
    files: [
      'apps/web/tests/hosted-foundation.test.ts',
      'apps/web/tests/hosted-invitation.test.ts',
      'apps/web/tests/hosted-collaboration.test.ts',
      'apps/web/tests/hosted-billing.test.ts',
      'apps/web/tests/hosted-automation.test.ts',
      'apps/web/tests/hosted-mcp-consent.test.ts',
    ],
    names: [
      'keeps local and hosted HTML entries separate',
      'builds hosted production assets in a graph that cannot load the local entry',
      'states exact trial, price, Google, and separate-authority terms without local upload behavior',
      'renders the required owner and invitee facts, states, recovery, and fragment boundary',
      'uses only same-origin trusted API routes for the bounded task and comment workflow',
      'renders keyboard-native task controls, assignment recovery, and durable comment tombstones',
      'defers Save focus restoration until the remounted Edit button is enabled',
      'uses same-origin GET and plan-only checkout requests without a browser amount or quantity',
      'renders exact active-seat totals, explicit choice, no-auto-charge, pending-seat, and Free recovery copy',
      'uses only same-origin browser-user routes and never puts credentials in URLs',
      'renders explicit one-time-secret, scope, revocation, export, and MCP-boundary copy',
      'distinguishes active, expired, and revoked credentials in the owner roster',
      'renders the exact client, redirect, workspace, scopes, denial, and account recovery boundaries',
      'renders immutable client IDs so same-name registrations remain distinguishable',
    ].join('|'),
  },
  {
    id: 'evidence-positive-paths',
    files: [
      'packages/hosted/tests/measurement.test.ts',
      'packages/hosted/tests/operations-config.test.ts',
      'packages/hosted/tests/operations-service.test.ts',
      'packages/hosted/tests/mcp-skill.test.ts',
    ],
    names: [
      'requires an exact 30-day trial window',
      'reproduces O-201 through O-204 and G-201 through G-204 without claiming outcomes',
      'requires the accepted member to act and comment on the assigned issue in sequence',
      'binds runtime, application limits, query budgets, budget thresholds, and cost guardrails to code',
      'keeps the public route behind Firebase Hosting/Cloud Run and omits an unused Storage runtime',
      'documents the fail-closed budget, isolated restore, and telemetry response boundaries',
      'reconciles observed economics into an exact guardrail-only cost-per-paid-seat report',
      'maps exactly the MCP PM allowlist and its stable protocol',
      'requires destructive confirmation and rejects prohibited product expansion',
    ].join('|'),
  },
];

for (const group of groups) {
  console.log(`\n[ct142] ${group.id}`);
  const result = spawnSync(
    'npx',
    ['vitest', 'run', ...group.files, '--config', 'vitest.config.ts', '--testNamePattern', group.names],
    {encoding: 'utf8', stdio: 'inherit'},
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n[ct142] all explicit nonsecurity groups passed');
