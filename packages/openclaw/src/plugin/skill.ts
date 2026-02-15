// OpenClaw skill wiring for LMDA.

import { isAbsolute, resolve } from 'node:path';

import {
  ConsoleReporter,
  InvariantEvaluator,
  JunitReporter,
  JsonReporter,
  ScenarioEngine,
  createReportBundle,
  loadScenario,
  type Reporter,
  type ReporterFormat,
  type ReporterOutput,
  type ScenarioReport,
} from '@lmda/core';

import { OpenClawProvider } from '../provider.js';
import type { OpenClawPluginRunner } from '../provider.js';
import { asString, isRecord, normalizeError } from '../shared/type-guards.js';

export interface OpenClawSkill {
  readonly name: string;
  readonly description: string;
  execute(input: string): Promise<string>;
}

export interface LmdaSkillOptions {
  readonly workspaceRoot: string;
  readonly pluginRunner: OpenClawPluginRunner;
  readonly scenarioRoot?: string;
  readonly defaultReporter?: ReporterFormat;
}

export interface LmdaSkillRequest {
  readonly scenarioPath: string;
  readonly reporterFormat?: ReporterFormat;
}

export class OpenClawSkillError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OpenClawSkillError';
  }
}

const REPORTER_FORMATS: readonly ReporterFormat[] = ['console', 'json', 'junit'];

const isReporterFormat = (value: unknown): value is ReporterFormat =>
  REPORTER_FORMATS.includes(value as ReporterFormat);

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
  scenario: ScenarioReport['scenario'],
  result: ScenarioReport['result'],
  startedAt: Date,
  finishedAt: Date,
): ScenarioReport => ({
  scenario,
  result,
  startedAt,
  finishedAt,
});

const resolveScenarioPath = (scenarioPath: string, scenarioRoot?: string): string => {
  if (isAbsolute(scenarioPath)) {
    return scenarioPath;
  }
  if (scenarioRoot && scenarioRoot.trim().length > 0) {
    return resolve(scenarioRoot, scenarioPath);
  }
  return scenarioPath;
};

const parseSkillRequest = (input: string): LmdaSkillRequest => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new OpenClawSkillError('Skill input must include a scenario path.');
  }

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new OpenClawSkillError('Skill input JSON is invalid.', {
        cause: error,
      });
    }

    if (!isRecord(parsed)) {
      throw new OpenClawSkillError('Skill input must be a JSON object.');
    }

    const scenarioPathValue = asString(parsed.scenarioPath);
    const scenarioPath = scenarioPathValue ? scenarioPathValue.trim() : '';
    if (scenarioPath.length === 0) {
      throw new OpenClawSkillError('Skill input must include a scenarioPath.');
    }

    const reporterValue = parsed.reporterFormat;
    if (reporterValue === undefined) {
      return { scenarioPath };
    }
    if (isReporterFormat(reporterValue)) {
      return { scenarioPath, reporterFormat: reporterValue };
    }
    throw new OpenClawSkillError('Skill input reporterFormat is invalid.');
  }

  return { scenarioPath: trimmed };
};

const runScenario = async (options: {
  readonly scenarioPath: string;
  readonly reporterFormat: ReporterFormat;
  readonly workspaceRoot: string;
  readonly pluginRunner: OpenClawPluginRunner;
}): Promise<ReporterOutput> => {
  const scenario = await loadScenario(options.scenarioPath);
  const provider = new OpenClawProvider({
    mode: 'plugin',
    workspaceRoot: options.workspaceRoot,
    pluginRunner: options.pluginRunner,
  });
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
  return reporter.report(bundle);
};

/**
 * Creates the LMDA skill definition for OpenClaw.
 */
export const createLmdaSkill = (options?: LmdaSkillOptions): OpenClawSkill => ({
  name: 'lmda',
  description: 'Runs LMDA security checks for OpenClaw agents.',
  execute: async (input: string): Promise<string> => {
    if (!options) {
      throw new OpenClawSkillError('LMDA skill is not configured.');
    }

    const workspaceRoot = options.workspaceRoot.trim();
    if (workspaceRoot.length === 0) {
      throw new OpenClawSkillError('LMDA skill requires a workspaceRoot.');
    }

    const request = parseSkillRequest(input);
    const scenarioPath = resolveScenarioPath(request.scenarioPath, options.scenarioRoot);
    const reporterFormat = request.reporterFormat ?? options.defaultReporter ?? 'console';

    try {
      const output = await runScenario({
        scenarioPath,
        reporterFormat,
        workspaceRoot,
        pluginRunner: options.pluginRunner,
      });
      return output.content;
    } catch (error) {
      throw new OpenClawSkillError('LMDA skill execution failed.', {
        cause: normalizeError(error),
      });
    }
  },
});
