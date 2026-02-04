import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createListCommand, listScenarioDirectory } from './list.js';

const scenarioYaml = (id: string): string => `
metadata:
  id: "${id}"
  name: "Scenario ${id}"
  severity: low
  attack_class: list
agent_config:
  tools:
    enabled: []
  memory: false
attack: []
invariants: {}
`;

describe('listScenarioDirectory', () => {
  it('should list scenarios from nested directories', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-list-'));
    const nestedDir = join(tempDir, 'nested');

    try {
      await mkdir(nestedDir);
      await writeFile(join(tempDir, 'a.yaml'), scenarioYaml('a'), 'utf8');
      await writeFile(join(nestedDir, 'b.yml'), scenarioYaml('b'), 'utf8');
      await writeFile(join(tempDir, 'README.txt'), 'ignore', 'utf8');

      const result = await listScenarioDirectory(tempDir);

      const ids = result.entries.map((entry) => entry.id).sort();
      expect(ids).toEqual(['a', 'b']);
      expect(result.failures).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should collect failures for invalid scenarios', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-list-'));

    try {
      await writeFile(join(tempDir, 'invalid.yaml'), 'invalid: [', 'utf8');

      const result = await listScenarioDirectory(tempDir);

      expect(result.entries).toHaveLength(0);
      expect(result.failures).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('createListCommand', () => {
  it('should register a list command', (): void => {
    const command = createListCommand();

    expect(command.name()).toBe('list');
  });
});
