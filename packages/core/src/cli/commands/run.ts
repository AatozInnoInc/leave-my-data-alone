// CLI command for running scenarios.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Command } from 'commander';

import { ScenarioEngine } from '../../engine/runner.js';
import { InvariantEvaluator } from '../../invariants/evaluator.js';
import { JunitReporter } from '../../reporters/junit.js';
import { JsonReporter } from '../../reporters/json.js';
import { ConsoleReporter } from '../../reporters/console.js';
import {
  createReportBundle,
  type Reporter,
  type ReporterFormat,
  type ReporterOutput,
  type ScenarioReport,
} from '../../reporters/types.js';
import {
  loadScenario,
  ScenarioLoadError,
  ScenarioValidationError,
} from '../../scenario/loader.js';
import type { ScenarioConfig } from '../../scenario/types.js';
import type { TelemetryProvider } from '../../telemetry/types.js';

export type ProviderFactory = (config: unknown) => TelemetryProvider | Promise<TelemetryProvider>;

export class ProviderModuleError extends Error {
  public readonly modulePath: string;
  public readonly exportName: string;

  constructor(modulePath: string, exportName: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderModuleError';
    this.modulePath = modulePath;
    this.exportName = exportName;
  }
}

export class ProviderConfigError extends Error {
  public readonly configPath: string;

  constructor(configPath: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderConfigError';
    this.configPath = configPath;
  }
}

export interface RunScenarioOptions {
  readonly scenarioPath: string;
  readonly providerFactory: ProviderFactory;
  readonly providerConfig: unknown;
  readonly reporterFormat: ReporterFormat;
  readonly outputPath?: string;
}

export interface RunScenarioResult {
  readonly report: ScenarioReport;
  readonly output: ReporterOutput;
}

const REPORTER_FORMATS: readonly ReporterFormat[] = ['console', 'json', 'junit'];

const isReporterFormat = (value: string): value is ReporterFormat =>
  REPORTER_FORMATS.includes(value as ReporterFormat);

/**
 * Normalizes reporter inputs to the supported format list.
 */
const parseReporterFormat = (value: string): ReporterFormat | null =>
  isReporterFormat(value) ? value : null;

const createReporter = (format: ReporterFormat): Reporter => {
  if (format === 'json') {
    return new JsonReporter();
  }

  if (format === 'junit') {
    return new JunitReporter();
  }

  return new ConsoleReporter();
};

const createScenarioReport = (
  scenario: ScenarioConfig,
  result: ScenarioReport['result'],
  startedAt: Date,
  finishedAt: Date,
): ScenarioReport => ({
  scenario,
  result,
  startedAt,
  finishedAt,
});

/**
 * Loads a provider factory from a module path and export name.
 */
export const loadProviderFactory = async (
  modulePath: string,
  exportName: string,
): Promise<ProviderFactory> => {
  const resolvedPath = resolve(process.cwd(), modulePath);
  const moduleUrl = pathToFileURL(resolvedPath).href;

  let moduleExports: Record<string, unknown>;
  try {
    moduleExports = (await import(moduleUrl)) as Record<string, unknown>;
  } catch (error) {
    throw new ProviderModuleError(
      modulePath,
      exportName,
      'Failed to load provider module.',
      { cause: error },
    );
  }

  const factory = moduleExports[exportName];
  if (typeof factory !== 'function') {
    throw new ProviderModuleError(
      modulePath,
      exportName,
      `Expected export "${exportName}" to be a function.`,
    );
  }

  return factory as ProviderFactory;
};

/**
 * Loads provider configuration from a JSON file.
 */
export const loadProviderConfig = async (configPath: string | undefined): Promise<unknown> => {
  if (configPath === undefined) {
    return undefined;
  }

  try {
    const raw = await readFile(configPath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ProviderConfigError(configPath, 'Failed to load provider config JSON.', {
      cause: error,
    });
  }
};

const writeReporterOutput = async (
  output: ReporterOutput,
  outputPath: string | undefined,
): Promise<void> => {
  if (outputPath === undefined) {
    console.log(output.content);
    return;
  }

  await writeFile(outputPath, output.content, 'utf8');
  console.log(`Wrote report to ${outputPath}`);
};

/**
 * Runs a scenario using a provided TelemetryProvider factory.
 */
export const runScenario = async (options: RunScenarioOptions): Promise<RunScenarioResult> => {
  const scenario = await loadScenario(options.scenarioPath);
  const provider = await options.providerFactory(options.providerConfig);
  const evaluator = new InvariantEvaluator({
    candidateValues: (scenario.fixtures?.canaries ?? []).map((canary) => canary.value),
  });
  const engine = new ScenarioEngine({ provider, evaluator });
  const reporter = createReporter(options.reporterFormat);

  const startedAt = new Date();
  const result = await engine.run(scenario);
  const finishedAt = new Date();

  const report = createScenarioReport(scenario, result, startedAt, finishedAt);
  const bundle = createReportBundle([report]);
  const output = reporter.report(bundle);

  await writeReporterOutput(output, options.outputPath);

  return { report, output };
};

const handleRunError = (error: unknown): void => {
  if (error instanceof ScenarioValidationError) {
    console.error('Scenario validation failed:');
    console.error(error.validationErrors.map((entry) => `  - ${entry}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  if (error instanceof ScenarioLoadError) {
    console.error('Scenario load failed:');
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (error instanceof ProviderModuleError || error instanceof ProviderConfigError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error.';
  console.error(message);
  process.exitCode = 1;
};

/**
 * Builds the run command.
 */
export const createRunCommand = (): Command => {
  const command = new Command('run');

  command
    .description('Run a scenario using a telemetry provider.')
    .argument('<scenarioPath>', 'Path to the scenario YAML file')
    .requiredOption('--provider <modulePath>', 'Module path that exports a provider factory')
    .option(
      '--provider-export <name>',
      'Named export to use as the provider factory',
      'createProvider',
    )
    .option('--provider-config <path>', 'Path to provider JSON config')
    .option(
      '-r, --reporter <format>',
      'Reporter format (console, json, junit)',
      'console',
    )
    .option('-o, --output <path>', 'Write report output to a file')
    .action(async (scenarioPath: string) => {
      const options = command.opts<{
        provider: string;
        providerExport: string;
        providerConfig?: string;
        reporter: ReporterFormat;
        output?: string;
      }>();

      try {
        const reporterFormat = parseReporterFormat(options.reporter);
        if (reporterFormat === null) {
          console.error(
            `Unknown reporter format "${options.reporter}". Use console, json, or junit.`,
          );
          process.exitCode = 1;
          return;
        }
        const providerFactory = await loadProviderFactory(options.provider, options.providerExport);
        const providerConfig = await loadProviderConfig(options.providerConfig);
        const baseOptions: RunScenarioOptions = {
          scenarioPath,
          providerFactory,
          providerConfig,
          reporterFormat,
        };
        const runOptions =
          options.output === undefined
            ? baseOptions
            : { ...baseOptions, outputPath: options.output };
        const runResult = await runScenario(runOptions);

        process.exitCode = runResult.report.result.passed ? 0 : 1;
      } catch (error) {
        handleRunError(error);
      }
    });

  return command;
};
