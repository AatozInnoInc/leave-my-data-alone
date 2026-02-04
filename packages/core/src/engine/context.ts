// Scenario execution context for the engine.

import type { ScenarioConfig } from '../scenario/types.js';
import type { TelemetryProvider } from '../telemetry/types.js';
import { InvariantEvaluator } from '../invariants/evaluator.js';

export interface ScenarioEngineContext {
  readonly scenario: ScenarioConfig;
  readonly provider: TelemetryProvider;
  readonly evaluator: InvariantEvaluator;
  readonly candidateValues: readonly string[];
}

export interface ScenarioContextOptions {
  readonly scenario: ScenarioConfig;
  readonly provider: TelemetryProvider;
  readonly evaluator?: InvariantEvaluator;
}

const getCandidateValues = (scenario: ScenarioConfig): readonly string[] =>
  (scenario.fixtures?.canaries ?? [])
    .map((canary) => canary.value)
    .filter((value) => value.length > 0);

/**
 * Builds a scenario execution context, including canary candidates for encoding checks.
 */
export const createScenarioContext = (options: ScenarioContextOptions): ScenarioEngineContext => {
  const candidateValues = getCandidateValues(options.scenario);
  const evaluator = options.evaluator ?? new InvariantEvaluator({ candidateValues });

  return {
    scenario: options.scenario,
    provider: options.provider,
    evaluator,
    candidateValues,
  };
};
