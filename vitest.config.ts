import { defineConfig } from 'vitest/config';

export default defineConfig({
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
  },
});
