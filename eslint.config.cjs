const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const nodeGlobals = {
  Buffer: 'readonly',
  NodeJS: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
};

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parser: tsParser,
      parserOptions: {
        project: [
          './packages/core/tsconfig.json',
          './packages/openclaw/tsconfig.json',
        ],
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Mirror previous @typescript-eslint configs (strict + stylistic, type-checked)
      ...tseslint.configs['strict-type-checked'].rules,
      ...tseslint.configs['stylistic-type-checked'].rules,

      // Project-specific rule overrides from .eslintrc.cjs
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
    },
  },
  // Separate config for .config.ts files (without type checking)
  {
    files: ['**/*.config.ts'],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
