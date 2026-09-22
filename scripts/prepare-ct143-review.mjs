import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

const inheritedRequest = 'docs/product/versions/v0.2.0/40-testing/CT-142/review-request.json';
const implementationRoot = 'docs/product/versions/v0.2.0/30-implementation/CT-143';
const testingRoot = 'docs/product/versions/v0.2.0/40-testing/CT-143';
const manifestPath = `${testingRoot}/candidate.sha256`;
const requestPath = `${testingRoot}/review-request.json`;

const walk = (root) => {
  if (!existsSync(root)) return [];
  const paths = [];
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...walk(path));
    else if (entry.isFile()) paths.push(path.split(sep).join('/'));
  }
  return paths;
};

const inherited = JSON.parse(readFileSync(inheritedRequest, 'utf8'));
const additions = [
  'Dockerfile.hosted',
  'vercel.json',
  'firebase.json',
  'firestore.rules',
  'package.json',
  'package-lock.json',
  'vitest.config.ts',
  'apps/web/vite.config.ts',
  'apps/web/src/hosted-api.ts',
  'apps/web/src/hosted-app.tsx',
  'apps/web/src/hosted-auth.ts',
  'apps/web/src/hosted-environment.ts',
  'apps/web/src/hosted-main.tsx',
  'apps/web/src/hosted-owner-entry.ts',
  'apps/web/src/hosted-workspace.tsx',
  'apps/web/src/hosted-workspace.css',
  'apps/web/src/hosted.css',
  'apps/web/tests/hosted-auth.test.ts',
  'apps/web/tests/hosted-collaboration.test.ts',
  'apps/web/tests/hosted-environment.test.ts',
  'apps/web/tests/hosted-invitation.test.ts',
  'apps/web/tests/hosted-owner-entry.test.ts',
  'apps/web/tests/hosted-session-refresh.test.ts',
  'packages/hosted/src/collaboration-service.ts',
  'packages/hosted/src/hosted-http.ts',
  'packages/hosted/src/mcp-server.ts',
  'packages/hosted/src/rest-api.ts',
  'packages/hosted/tests/collaboration-http.test.ts',
  'packages/hosted/tests/collaboration-service.test.ts',
  'packages/hosted/tests/hosted-http.test.ts',
  'packages/hosted/tests/mcp-server.test.ts',
  'packages/hosted/tests/project-management-service.test.ts',
  'packages/hosted/tests/rest-api.test.ts',
  'ops/hosted/README.md',
  'ops/hosted/environments/development.json',
  'ops/hosted/environments/production.json',
  'scripts/tests/ct143-nonsecurity-gates.mjs',
  'scripts/validate-hosted-environments.mjs',
  'scripts/prepare-ct143-review.mjs',
  'design-qa.md',
  ...walk(implementationRoot),
  ...walk(testingRoot),
];

const paths = [...new Set([
  ...Object.keys(inherited.candidate?.sha256 ?? {}),
  ...additions,
])]
  .filter((path) => path !== manifestPath && path !== requestPath)
  .filter((path) => existsSync(path) && statSync(path).isFile())
  .sort();

const lines = paths.map((path) => {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  return `${digest}  ${relative('.', path).split(sep).join('/')}`;
});
writeFileSync(manifestPath, `${lines.join('\n')}\n`);

const aggregate = createHash('sha256').update(lines.join('\n')).digest('hex');
console.log(JSON.stringify({
  prepared: true,
  manifest: manifestPath,
  sealed_file_count: paths.length,
  aggregate_sha256: aggregate,
}, null, 2));
