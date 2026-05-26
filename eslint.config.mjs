import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Flat config covering the whole pnpm monorepo. Non-type-checked TS rules only
// (fast, no project graph) — the strict `tsc` typecheck already covers types.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/backend/public/**', // copied Vite build at deploy time
      'apps/backend/src/db/migrations/**', // generated SQL + snapshots
      '**/*.config.{js,cjs,mjs,ts}',
      '**/vite.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Unused vars: warn, and allow a leading-underscore opt-out (e.g. the error
  // handler's `_next`, which Express needs for arity but we don't use).
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Backend + shared run on Node.
  {
    files: ['apps/backend/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Frontend runs in the browser; enforce the Rules of Hooks and flag (warn)
  // missing effect deps + non-component exports that break Fast Refresh.
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Test files use Node globals too.
  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Keep ESLint out of Prettier's lane (formatting handled by `pnpm format`).
  prettier,
);
