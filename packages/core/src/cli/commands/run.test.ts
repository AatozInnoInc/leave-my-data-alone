import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { Message, ScenarioConfig } from '../../scenario/types.js';
import { createScenarioYaml } from '../../shared/test-helpers.js';
import type { TelemetryEvent, TelemetryProvider } from '../../telemetry/types.js';
import {
  createRunCommand,
  loadProviderFactory,
  runScenario,
  type ProviderFactory,
} from './run.js';

const buildRunScenarioYaml = (): string =>
  createScenarioYaml()
    .withId('run-test')
    .withName('Run test scenario')
    .withAttackClass('run')
    .withAttack([{ role: 'user', content: 'Hello' }])
    .withMustNotContain([{ pattern: 'CANARY' }])
    .build();

class StubProvider implements TelemetryProvider {
  public configure(_scenario: ScenarioConfig): Promise<void> {
    return Promise.resolve();
  }

  public async *execute(
    _messages: readonly Message[],
  ): AsyncGenerator<TelemetryEvent> {
    // Keeps the stub aligned with the async generator contract.
    await Promise.resolve();
    yield {
      timestamp: new Date(0),
      type: 'llm_output',
      payload: { content: 'CANARY' },
    };
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }
}

describe('runScenario', () => {
  it('should execute a scenario and return reporter output', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-run-'));
    const scenarioPath = join(tempDir, 'scenario.yaml');

    try {
      await writeFile(scenarioPath, buildRunScenarioYaml(), 'utf8');

      const providerFactory: ProviderFactory = () => Promise.resolve(new StubProvider());
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

  it('should reject invalid reporter formats', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-cli-'));
    const scenarioPath = join(tempDir, 'scenario.yaml');
    const modulePath = join(tempDir, 'provider.mjs');
    const moduleContents = `
      export const createProvider = async () => ({
        configure: async () => {},
        execute: async function* () {},
        teardown: async () => {},
      });
    `;

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await writeFile(scenarioPath, buildRunScenarioYaml(), 'utf8');
      await writeFile(modulePath, moduleContents, 'utf8');

      process.exitCode = undefined;
      const command = createRunCommand();
      await command.parseAsync([
        'node',
        'lmda',
        scenarioPath,
        '--provider',
        modulePath,
        '--reporter',
        'csv',
      ]);

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown reporter format'),
      );
    } finally {
      errorSpy.mockRestore();
      process.exitCode = originalExitCode;
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
