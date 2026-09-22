import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDirectories = [
  'apps/api/dist',
  'apps/hosted-service/dist',
  'apps/web/dist',
  'ops/cli/dist',
  'packages/contracts/dist',
  'packages/db/dist',
  'packages/domain/dist',
  'packages/hosted/dist',
  'packages/test-fixtures/dist',
  'packages/ui/dist',
];

await Promise.all(outputDirectories.map((directory) => (
  rm(resolve(root, directory), { force: true, recursive: true })
)));
