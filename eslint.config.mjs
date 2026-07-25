import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'scripts/**', '*.config.mjs', 'packages/database/drizzle.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  prettier,
  { files: ['**/*.{ts,tsx}'], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'], rules: { '@typescript-eslint/no-floating-promises': 'off' } },
);
