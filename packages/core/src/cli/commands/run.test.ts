import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ScenarioConfig } from '../../scenario/types.js';
import type { TelemetryEvent, TelemetryProvider } from '../../telemetry/types.js';
import {
  createRunCommand,
  loadProviderFactory,
  runScenario,
  type ProviderFactory,
} from './run.js';

const scenarioYaml = (): string => `
metadata:
  id: "run-test"
  name: "Run test scenario"
  severity: low
  attack_class: run
agent_config:
  tools:
    enabled: []
  memory: false
attack:
  - role: user
    content: "Hello"
invariants:
  must_not_contain:
    - pattern: "CANARY"
`;

class StubProvider implements TelemetryProvider {
  public async configure(_scenario: ScenarioConfig): Promise<void> {
    // No-op.
  }

  public async *execute(): AsyncGenerator<TelemetryEvent> {
    yield {
      timestamp: new Date(0),
      type: 'llm_output',
      payload: { content: 'CANARY' },
    };
  }

  public async teardown(): Promise<void> {
    // No-op.
  }
}

describe('runScenario', () => {
  it('should execute a scenario and return reporter output', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-run-'));
    const scenarioPath = join(tempDir, 'scenario.yaml');

    try {
      await writeFile(scenarioPath, scenarioYaml(), 'utf8');

      const providerFactory: ProviderFactory = async () => new StubProvider();
      const result = await runScenario({
        scenarioPath,
        providerFactory,
        providerConfig: undefined,
        reporterFormat: 'json',
      });

      expect(result.report.result.passed).toBe(false);
      expect(result.output.format).toBe('json');
      expect(result.output.content).toContain('"summary"');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('loadProviderFactory', () => {
  it('should load a provider factory from a module', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-provider-'));
    const modulePath = join(tempDir, 'provider.mjs');

    const moduleContents = `
      export const createProvider = async () => ({
        configure: async () => {},
        execute: async function* () {},
        teardown: async () => {},
      });
    `;

    try {
      await writeFile(modulePath, moduleContents, 'utf8');

      const factory = await loadProviderFactory(modulePath, 'createProvider');

      expect(typeof factory).toBe('function');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('createRunCommand', () => {
  it('should register a run command', (): void => {
    const command = createRunCommand();

    expect(command.name()).toBe('run');
  });
});
