// Scenario execution engine.

import type { ScenarioConfig } from '../scenario/types.js';
import type { TelemetryEvent, TelemetryProvider } from '../telemetry/types.js';
import type { EvaluationResult } from '../invariants/types.js';
import type { InvariantEvaluator } from '../invariants/evaluator.js';
import { createScenarioContext } from './context.js';

export type ScenarioExecutionStage = 'configure' | 'execute' | 'teardown';

/**
 * Error raised when scenario execution fails at a specific stage.
 */
export class ScenarioExecutionError extends Error {
  public readonly stage: ScenarioExecutionStage;
  public readonly scenarioId: string;

  constructor(stage: ScenarioExecutionStage, scenarioId: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScenarioExecutionError';
    this.stage = stage;
    this.scenarioId = scenarioId;
  }
}

export interface ScenarioEngineOptions {
  readonly provider: TelemetryProvider;
  readonly evaluator?: InvariantEvaluator;
}

/**
 * Runs scenarios by coordinating provider execution and invariant evaluation.
 */
export class ScenarioEngine {
  private readonly provider: TelemetryProvider;
  private readonly evaluatorOverride?: InvariantEvaluator;

  constructor(options: ScenarioEngineOptions) {
    this.provider = options.provider;
    this.evaluatorOverride = options.evaluator;
  }

  public async run(scenario: ScenarioConfig): Promise<EvaluationResult> {
    const context = createScenarioContext({
      scenario,
      provider: this.provider,
      evaluator: this.evaluatorOverride,
    });

    await this.configureScenario(context.provider, scenario);

    let telemetry: TelemetryEvent[] = [];
    let executionError: ScenarioExecutionError | null = null;

    try {
      telemetry = await this.collectTelemetry(context.provider, scenario.attack);
    } catch (error) {
      executionError = this.wrapError('execute', scenario, 'Failed to execute scenario.', error);
    }

    // Always attempt teardown; surface execute errors after cleanup.
    const teardownError = await this.teardownScenario(context.provider, scenario);

    if (executionError) {
      throw executionError;
    }

    if (teardownError) {
      throw teardownError;
    }

    return context.evaluator.evaluate(scenario.invariants, telemetry);
  }

  private async configureScenario(
    provider: TelemetryProvider,
    scenario: ScenarioConfig,
  ): Promise<void> {
    try {
      await provider.configure(scenario);
    } catch (error) {
      throw this.wrapError('configure', scenario, 'Failed to configure provider.', error);
    }
  }

  private async collectTelemetry(
    provider: TelemetryProvider,
    messages: ScenarioConfig['attack'],
  ): Promise<TelemetryEvent[]> {
    const events: TelemetryEvent[] = [];

    for await (const event of provider.execute(messages)) {
      events.push(event);
    }

    return events;
  }

  private async teardownScenario(
    provider: TelemetryProvider,
    scenario: ScenarioConfig,
  ): Promise<ScenarioExecutionError | null> {
    try {
      await provider.teardown();
    } catch (error) {
      return this.wrapError('teardown', scenario, 'Failed to teardown provider.', error);
    }

    return null;
  }

  private wrapError(
    stage: ScenarioExecutionStage,
    scenario: ScenarioConfig,
    message: string,
    error: unknown,
  ): ScenarioExecutionError {
    return new ScenarioExecutionError(stage, scenario.metadata.id, message, {
      cause: error,
    });
  }
}
