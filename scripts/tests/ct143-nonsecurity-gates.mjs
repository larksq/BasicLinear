import {spawnSync} from 'node:child_process';

const groups = [
  {
    id: 'environment-and-google-entry',
    files: [
      'apps/web/tests/hosted-auth.test.ts',
      'apps/web/tests/hosted-environment.test.ts',
      'apps/web/tests/hosted-owner-entry.test.ts',
      'apps/web/tests/hosted-session-refresh.test.ts',
      'packages/hosted/tests/hosted-http.test.ts',
    ],
    names: [
      'finishes local persistence before the first popup is requested',
      'refreshes once and retries the same idempotent mutation without losing its draft',
      'returns the original authentication error when Firebase has no refreshable user',
      'allows production only when the production provider binding is ready',
      'rejects shared or cross-environment Firebase projects',
      'continues a provider-ready sign-in through the existing workspace bootstrap',
      'returns one safe bootstrap result across retried tabs',
      'creates, lists, inspects, and accepts an email-bound fragment invitation',
    ].join('|'),
  },
  {
    id: 'rich-workspace-data-flow',
    files: [
      'packages/hosted/tests/collaboration-service.test.ts',
      'packages/hosted/tests/collaboration-http.test.ts',
      'packages/hosted/tests/project-management-service.test.ts',
    ],
    names: [
      'persists rich issue content, sub-issue relationships, resources, and readable activity',
      'completes the exact owner assignment, member action, and comment chain',
      'creates and revises projects and milestones with retry, audit, and stale-revision safety',
    ].join('|'),
  },
  {
    id: 'browser-product-surface',
    files: [
      'apps/web/tests/hosted-collaboration.test.ts',
      'apps/web/tests/hosted-invitation.test.ts',
    ],
    names: [
      'uses the signed-in browser boundary for real project and milestone work',
      'renders the hosted product as an operating workspace instead of a stacked information page',
      'uses the hosted issue API for rich issue content and the durable activity feed',
      'uses owner-authenticated same-origin lifecycle routes with bounded JSON inputs',
      'renders the required owner and invitee facts, states, recovery, and fragment boundary',
    ].join('|'),
  },
  {
    id: 'rest-and-mcp-parity',
    files: [
      'packages/hosted/tests/rest-api.test.ts',
      'packages/hosted/tests/mcp-server.test.ts',
    ],
    names: [
      'publishes an exact OpenAPI 3.1.1 contract with no excluded product routes',
      'lists exactly the scoped PM allowlist and calls the shared service over request-scoped SSE',
      'preserves reciprocal REST/MCP state, retry, revision-conflict, and audit semantics',
    ].join('|'),
  },
];

let selectedFiles = 0;
for (const group of groups) {
  selectedFiles += group.files.length;
  console.log(`\n[ct143] ${group.id}`);
  const result = spawnSync(
    'npx',
    ['vitest', 'run', ...group.files, '--config', 'vitest.config.ts', '--testNamePattern', group.names],
    {encoding: 'utf8', stdio: 'inherit'},
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n[ct143] all positive nonsecurity groups passed (${selectedFiles} file selections)`);
