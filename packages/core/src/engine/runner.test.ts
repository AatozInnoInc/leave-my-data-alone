import { describe, expect, it } from 'vitest';

import type { Message, ScenarioConfig } from '../scenario/types.js';
import type { TelemetryEvent, TelemetryProvider } from '../telemetry/types.js';
import { encodeBase64Variants } from '../invariants/encoding.js';
import { ScenarioEngine, ScenarioExecutionError } from './runner.js';

const createScenario = (invariants: ScenarioConfig['invariants']): ScenarioConfig => ({
  metadata: {
    id: 'engine-test-001',
    name: 'Engine test scenario',
    severity: 'low',
    attackClass: 'engine_test',
  },
  agentConfig: {
    tools: {
      enabled: [],
    },
    memory: false,
  },
  attack: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
  invariants,
});

class StubProvider implements TelemetryProvider {
  public configureCalled = false;
  public teardownCalled = false;
  public readonly events: readonly TelemetryEvent[];
  public readonly messages: Message[] = [];

  constructor(events: readonly TelemetryEvent[]) {
    this.events = events;
  }

  configure(_scenario: ScenarioConfig): Promise<void> {
    this.configureCalled = true;
    return Promise.resolve();
  }

  async *execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    this.messages.push(...messages);

    // Keeps the stub aligned with async generator behavior.
    await Promise.resolve();
    for (const event of this.events) {
      yield event;
    }
  }

  teardown(): Promise<void> {
    this.teardownCalled = true;
    return Promise.resolve();
  }
}

describe('ScenarioEngine', () => {
  it('should execute provider and evaluate telemetry', async (): Promise<void> => {
    const events: TelemetryEvent[] = [
      {
        timestamp: new Date(0),
        type: 'llm_output',
        payload: { content: 'Leak CANARY_SECRET_1' },
      },
    ];
    const provider = new StubProvider(events);
    const engine = new ScenarioEngine({ provider });
    const scenario = createScenario({
      mustNotContain: [{ pattern: 'CANARY_SECRET_1' }],
    });

    const result = await engine.run(scenario);

    expect(provider.configureCalled).toBe(true);
    expect(provider.teardownCalled).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it('should use scenario canaries for must_not_encode defaults', async (): Promise<void> => {
    const canary = 'CANARY_SECRET_2';
    const encoded = encodeBase64Variants(canary)[0];

    if (encoded) {
      const events: TelemetryEvent[] = [
        {
          timestamp: new Date(0),
          type: 'llm_output',
          payload: { content: `Leak ${encoded}` },
        },
      ];
      const provider = new StubProvider(events);
      const engine = new ScenarioEngine({ provider });
      const scenario: ScenarioConfig = {
        ...createScenario({ mustNotEncode: [{ type: 'base64' }] }),
        fixtures: {
          canaries: [
            {
              id: 'api_key',
              value: canary,
            },
          ],
        },
      };

      const result = await engine.run(scenario);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
    } else {
      throw new Error('Expected base64 variant.');
    }
  });

  it('should surface configure failures', async (): Promise<void> => {
    class ConfigureErrorProvider extends StubProvider {
      override configure(_scenario: ScenarioConfig): Promise<void> {
        this.configureCalled = true;
        return Promise.reject(new Error('configure failure'));
      }
    }

    const provider = new ConfigureErrorProvider([]);
    const engine = new ScenarioEngine({ provider });
    const scenario = createScenario({ mustNotContain: [] });

    try {
      await engine.run(scenario);
    } catch (error) {
      if (error instanceof ScenarioExecutionError) {
        expect(error.stage).toBe('configure');
        return;
      }

      throw error;
    }

    throw new Error('Expected ScenarioExecutionError.');
  });

  it('should surface execute failures and still teardown', async (): Promise<void> => {
    class ExecuteErrorProvider extends StubProvider {
      override async *execute(_messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
        await Promise.resolve();
        yield { timestamp: new Date(0), type: 'llm_output', payload: {} };
        // Throw is reachable on next generator iteration.
        yield* [];
        throw new Error('execute failure');
      }
    }

    const provider = new ExecuteErrorProvider([]);
    const engine = new ScenarioEngine({ provider });
    const scenario = createScenario({ mustNotContain: [] });

    try {
      await engine.run(scenario);
    } catch (error) {
      if (error instanceof ScenarioExecutionError) {
        expect(error.stage).toBe('execute');
        expect(provider.teardownCalled).toBe(true);
        return;
      }

      throw error;
    }

    throw new Error('Expected ScenarioExecutionError.');
  });

  it('should surface teardown failures', async (): Promise<void> => {
    class TeardownErrorProvider extends StubProvider {
      override teardown(): Promise<void> {
        this.teardownCalled = true;
        return Promise.reject(new Error('teardown failure'));
      }
    }

    const provider = new TeardownErrorProvider([]);
    const engine = new ScenarioEngine({ provider });
    const scenario = createScenario({ mustNotContain: [] });

    try {
      await engine.run(scenario);
    } catch (error) {
      if (error instanceof ScenarioExecutionError) {
        expect(error.stage).toBe('teardown');
        return;
      }

      throw error;
    }

    throw new Error('Expected ScenarioExecutionError.');
  });
});
