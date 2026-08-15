import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@scripts': '/scripts',
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'skills/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      ['tests/**/*.test.tsx', 'jsdom'],
    ],
    timeout: 60000,
    slowTestThreshold: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'scripts/**'],
    },
  },
});
