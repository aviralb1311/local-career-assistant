import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: 'VITE_',
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
  },
});
