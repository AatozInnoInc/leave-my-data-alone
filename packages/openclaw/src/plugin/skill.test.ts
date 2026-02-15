import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createLmdaSkill, OpenClawSkillError } from './skill.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../../../../');
const scenarioPath = 'scenarios/dummy-scenario.yaml';

describe('createLmdaSkill', () => {
  it('should surface unconfigured skill execution', async () => {
    // Arrange
    const skill = createLmdaSkill();

    // Act
    const action = (): Promise<string> => skill.execute('run security check');

    // Assert
    await expect(action()).rejects.toBeInstanceOf(OpenClawSkillError);
  });

  it('should run scenarios with a plugin runner', async () => {
    // Arrange
    let receivedMessages: unknown = null;
    const skill = createLmdaSkill({
      workspaceRoot: '/tmp/lmda',
      scenarioRoot: repoRoot,
      pluginRunner: async ({ messages, eventSink }) => {
        receivedMessages = messages;
        eventSink.handleEvent({
          timestamp: new Date(0),
          type: 'llm_output',
          payload: { content: 'ok' },
        });
      },
    });

    const input = JSON.stringify({ scenarioPath, reporterFormat: 'json' });

    // Act
    const output = await skill.execute(input);
    const parsed = JSON.parse(output) as {
      summary?: { total?: number; passed?: number; failed?: number };
      reports?: Array<{ result?: { passed?: boolean } }>;
    };

    // Assert
    expect(receivedMessages).toEqual([{ role: 'user', content: 'Run a dummy user prompt.' }]);
    expect(parsed.summary?.total).toBe(1);
    expect(parsed.summary?.failed).toBe(0);
    expect(parsed.reports?.[0]?.result?.passed).toBe(true);
  });

  it('should reject invalid reporter formats', async () => {
    // Arrange
    const skill = createLmdaSkill({
      workspaceRoot: '/tmp/lmda',
      scenarioRoot: repoRoot,
      pluginRunner: async () => Promise.resolve(),
    });
    const input = JSON.stringify({ scenarioPath, reporterFormat: 'csv' });

    // Act
    const action = (): Promise<string> => skill.execute(input);

    // Assert
    await expect(action()).rejects.toBeInstanceOf(OpenClawSkillError);
  });
});
