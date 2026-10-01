import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextConfig from 'eslint-config-next';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      'deploy/**',
      '**/.next/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextConfig.map((c) => ({ ...c, files: ['apps/web/**/*.{js,jsx,ts,tsx}'] })),
  {
    files: ['**/scripts/**/*.{js,mjs,ts}', '**/*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    files: ['apps/web/public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', clients: 'readonly' },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  }
);
