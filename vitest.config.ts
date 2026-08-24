import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    environment: 'node',
    include: [
      'packages/**/tests/**/*.test.ts',
      'apps/api/tests/**/*.test.ts',
      'apps/web/tests/**/*.test.ts',
    ],
    exclude: ['**/*.integration.test.ts'],
    coverage: { enabled: false },
  },
});
