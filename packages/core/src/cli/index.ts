// CLI entrypoint for LMDA core.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { createListCommand } from './commands/list.js';
import { createRunCommand } from './commands/run.js';
import { createSourcesCommand } from './commands/sources.js';
import { createSyncCommand } from './commands/sync.js';
import { createValidateCommand } from './commands/validate.js';

/**
 * Builds the LMDA CLI program with registered commands.
 */
export const buildCli = (): Command => {
  const program = new Command();

  program
    .name('lmda')
    .description('LMDA security testing framework CLI')
    .addCommand(createListCommand())
    .addCommand(createRunCommand())
    .addCommand(createSourcesCommand())
    .addCommand(createSyncCommand())
    .addCommand(createValidateCommand());

  return program;
};

/**
 * Runs the CLI with the provided arguments.
 */
export const runCli = async (argv: readonly string[]): Promise<void> => {
  const program = buildCli();

  await program.parseAsync([...argv]);
};

/**
 * Entrypoint when this file is run directly (e.g. tsx packages/core/src/cli/index.ts validate ...).
 */
const scriptPath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1] !== undefined ? resolve(process.cwd(), process.argv[1]) : '';
const isMain = entryPath !== '' && resolve(entryPath) === scriptPath;
if (isMain) {
  runCli(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
