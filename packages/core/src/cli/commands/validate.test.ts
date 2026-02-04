import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createValidateCommand, validateScenarioFile } from './validate.js';

const createScenarioYaml = (): string => `
metadata:
  id: "validate-test"
  name: "Validate test scenario"
  severity: low
  attack_class: validate
agent_config:
  tools:
    enabled: []
  memory: false
attack: []
invariants: {}
`;

describe('validateScenarioFile', () => {
  it('should resolve for valid scenarios', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-validate-'));
    const scenarioPath = join(tempDir, 'scenario.yaml');

    try {
      await writeFile(scenarioPath, createScenarioYaml(), 'utf8');

      await expect(validateScenarioFile(scenarioPath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should reject invalid scenarios', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-validate-'));
    const scenarioPath = join(tempDir, 'scenario.yaml');

    try {
      await writeFile(scenarioPath, 'invalid: yaml: [', 'utf8');

      await expect(validateScenarioFile(scenarioPath)).rejects.toBeInstanceOf(Error);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('createValidateCommand', () => {
  it('should register a validate command', (): void => {
    const command = createValidateCommand();

    expect(command.name()).toBe('validate');
  });
});
