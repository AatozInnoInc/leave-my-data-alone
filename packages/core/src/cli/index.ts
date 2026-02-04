// CLI entrypoint for LMDA core.

import { Command } from 'commander';

import { createValidateCommand } from './commands/validate.js';

/**
 * Builds the LMDA CLI program with registered commands.
 */
export const buildCli = (): Command => {
  const program = new Command();

  program
    .name('lmda')
    .description('LMDA security testing framework CLI')
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
