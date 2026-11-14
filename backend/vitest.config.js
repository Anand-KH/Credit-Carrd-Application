import { defineConfig } from 'vitest/config';

// `npm test` runs the fast unit/API suite. Tests that start a real MongoDB
// replica set live in test/integration and run via `npm run test:integration`
// (vitest --mode integration).
export default defineConfig(({ mode }) => {
  const integration = mode === 'integration';
  return {
    test: {
      include: integration ? ['test/integration/**/*.test.js'] : ['test/**/*.test.js'],
      exclude: integration ? ['node_modules/**'] : ['test/integration/**', 'node_modules/**'],
      testTimeout: integration ? 60_000 : 5_000,
      hookTimeout: integration ? 300_000 : 10_000,
    },
  };
});
