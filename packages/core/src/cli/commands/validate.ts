// CLI command for validating scenario files.

import { Command } from 'commander';

import { loadScenario, ScenarioLoadError, ScenarioValidationError } from '../../scenario/loader.js';

/**
 * Loads a scenario file to ensure it is valid.
 */
export const validateScenarioFile = async (scenarioPath: string): Promise<void> => {
  await loadScenario(scenarioPath);
};

const formatValidationErrors = (errors: readonly string[]): string =>
  errors.map((error) => `  - ${error}`).join('\n');

/**
 * Builds the validate command.
 */
export const createValidateCommand = (): Command => {
  const command = new Command('validate');

  command
    .description('Validate a scenario YAML file.')
    .argument('<scenarioPath>', 'Path to the scenario YAML file')
    .action(async (scenarioPath: string) => {
      try {
        await validateScenarioFile(scenarioPath);
        console.log(`VALID: ${scenarioPath}`);
      } catch (error) {
        if (error instanceof ScenarioValidationError) {
          console.error(`INVALID: ${scenarioPath}`);
          console.error(formatValidationErrors(error.validationErrors));
          process.exitCode = 1;
          return;
        }

        if (error instanceof ScenarioLoadError) {
          console.error(`FAILED TO LOAD: ${scenarioPath}`);
          console.error(error.message);
          process.exitCode = 1;
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error.';
        console.error(`ERROR: ${scenarioPath}`);
        console.error(message);
        process.exitCode = 1;
      }
    });

  return command;
};
