import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    environment: 'node',
    include: ['packages/hosted/tests/firestore-rules.emulator.test.ts', 'apps/hosted-service/tests/*.emulator.test.ts'],
    coverage: { enabled: false },
    fileParallelism: false,
  },
});
