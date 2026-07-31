import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/unit/setup.ts'],
    // next-intl ships ESM that imports 'next/server' / 'next/navigation'
    // extensionless. Inlining it routes those through the resolve.alias
    // below instead of node's bare-specifier resolution, which lets tests
    // import src/middleware.ts and locale-aware page modules.
    server: { deps: { inline: ['next-intl'] } },
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // next-intl's ESM build imports 'next/server' and 'next/navigation'
      // without a file extension, which vitest's ESM loader can't resolve.
      // Point both at the real files so tests can import the middleware and
      // any page module that pulls in @/i18n/routing.
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
      'next/navigation': path.resolve(__dirname, './node_modules/next/navigation.js'),
    },
  },
});
