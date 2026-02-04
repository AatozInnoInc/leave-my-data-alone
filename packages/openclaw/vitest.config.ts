import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const currentDir = dirname(fileURLToPath(import.meta.url));
const coreIndex = resolve(currentDir, '../core/src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@lmda/core': coreIndex,
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
