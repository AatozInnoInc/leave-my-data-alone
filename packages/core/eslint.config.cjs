/**
 * Package-level ESLint config so node globals (console, process) are in scope
 * when lint runs from this directory (e.g. pnpm -r lint). Spreads root config.
 */
const globals = require('globals');
const rootConfig = require('../../eslint.config.cjs');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...rootConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
