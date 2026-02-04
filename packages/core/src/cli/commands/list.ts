// CLI command for listing scenario files.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Command } from 'commander';

import { loadScenario, ScenarioLoadError, ScenarioValidationError } from '../../scenario/loader.js';
import type { ScenarioConfig } from '../../scenario/types.js';

export interface ScenarioListEntry {
  readonly id: string;
  readonly name: string;
  readonly severity: ScenarioConfig['metadata']['severity'];
  readonly path: string;
}

export interface ScenarioListFailure {
  readonly path: string;
  readonly message: string;
}

export interface ScenarioListResult {
  readonly entries: readonly ScenarioListEntry[];
  readonly failures: readonly ScenarioListFailure[];
}

const isScenarioFilename = (name: string): boolean =>
  name.endsWith('.yaml') || name.endsWith('.yml');

const collectScenarioPaths = async (rootDir: string): Promise<string[]> => {
  const results: string[] = [];
  const directories: string[] = [rootDir];

  // Depth-first traversal to gather scenario files.
  while (directories.length > 0) {
    const current = directories.pop();
    if (current === undefined) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(current, entry.name);

      if (entry.isDirectory()) {
        directories.push(entryPath);
      }

      if (entry.isFile() && isScenarioFilename(entry.name)) {
        results.push(entryPath);
      }
    }
  }

  return results.sort();
};

const buildFailureMessage = (error: unknown): string => {
  if (error instanceof ScenarioValidationError) {
    return error.validationErrors.join('; ');
  }

  if (error instanceof ScenarioLoadError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error.';
};

/**
 * Lists all scenario files under a directory, returning valid entries and failures.
 */
export const listScenarioDirectory = async (directory: string): Promise<ScenarioListResult> => {
  const paths = await collectScenarioPaths(directory);
  const entries: ScenarioListEntry[] = [];
  const failures: ScenarioListFailure[] = [];

  for (const path of paths) {
    try {
      const scenario = await loadScenario(path);
      entries.push({
        id: scenario.metadata.id,
        name: scenario.metadata.name,
        severity: scenario.metadata.severity,
        path,
      });
    } catch (error) {
      failures.push({
        path,
        message: buildFailureMessage(error),
      });
    }
  }

  return { entries, failures };
};

/**
 * Formats the output per entry, i.e.
 * dummy-scenario-001 (medium) - Medium dummy scenario for CLI validation :: scenarios/dummy-scenario.yaml
 * dummy-scenario-002 (small) - Small dummy scenario for CLI validation :: scenarios/dummy-scenario-small.yaml
 */
const formatEntry = (entry: ScenarioListEntry): string =>
  `${entry.id} (${entry.severity}) - ${entry.name} :: ${entry.path}`;

/**
 * Formats the output per failure, i.e.
 *   - scenarios/dummy-scenario.yaml: Failed to load scenario: Unknown error.
 */
const formatFailure = (failure: ScenarioListFailure): string =>
  `  - ${failure.path}: ${failure.message}`;

/**
 * Builds the list command.
 */
export const createListCommand = (): Command => {
  const command = new Command('list');

  command
    .description('List scenario files in a directory.')
    .option('-d, --dir <dir>', 'Directory to search for scenarios', 'scenarios')
    .action(async () => {
      const options = command.opts<{ dir: string }>();
      const result = await listScenarioDirectory(options.dir);

      if (result.entries.length === 0) {
        console.log('No scenarios found.');
      }

      if (result.entries.length > 0) {
        for (const entry of result.entries) {
          console.log(formatEntry(entry));
        }
      }

      if (result.failures.length > 0) {
        console.error('Failed to load scenarios:');
        for (const failure of result.failures) {
          console.error(formatFailure(failure));
        }
        process.exitCode = 1;
      }
    });

  return command;
};
