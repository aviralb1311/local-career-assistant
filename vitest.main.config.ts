import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'main',
    environment: 'node',
    include: ['src/main/__tests__/**/*.test.ts'],
  },
});
