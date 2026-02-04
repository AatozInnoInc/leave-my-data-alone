import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FixtureProvisionError, provisionFixtures } from './provisioner.js';

describe('provisionFixtures', () => {
  it('should copy workspace fixtures into the workspace root', async () => {
    // Arrange
    const scenarioRoot = await mkdtemp(join(tmpdir(), 'lmda-scenario-'));
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'lmda-workspace-'));
    const sourcePath = join(scenarioRoot, 'fixtures', 'data.txt');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, 'hello', 'utf8');

    try {
      // Act
      const result = await provisionFixtures({
        scenarioRoot,
        workspaceRoot,
        fixtures: {
          workspace: [{ source: 'fixtures/data.txt', target: 'Documents/data.txt' }],
        },
      });

      // Assert
      const targetPath = join(workspaceRoot, 'Documents', 'data.txt');
      const content = await readFile(targetPath, 'utf8');
      expect(content).toBe('hello');
      expect(result.workspace[0]?.target).toBe(targetPath);
    } finally {
      await rm(scenarioRoot, { recursive: true, force: true });
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should treat tilde targets as workspace root', async () => {
    // Arrange
    const scenarioRoot = await mkdtemp(join(tmpdir(), 'lmda-scenario-'));
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'lmda-workspace-'));
    const sourcePath = join(scenarioRoot, 'fixtures', 'secret.txt');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, 'secret', 'utf8');

    try {
      // Act
      await provisionFixtures({
        scenarioRoot,
        workspaceRoot,
        fixtures: {
          workspace: [{ source: 'fixtures/secret.txt', target: '~/config/secret.txt' }],
        },
      });

      // Assert
      const targetPath = join(workspaceRoot, 'config', 'secret.txt');
      const content = await readFile(targetPath, 'utf8');
      expect(content).toBe('secret');
    } finally {
      await rm(scenarioRoot, { recursive: true, force: true });
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should reject targets that escape the workspace root', async () => {
    // Arrange
    const scenarioRoot = await mkdtemp(join(tmpdir(), 'lmda-scenario-'));
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'lmda-workspace-'));
    const sourcePath = join(scenarioRoot, 'fixtures', 'data.txt');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, 'hello', 'utf8');

    try {
      // Act
      const action = (): Promise<unknown> =>
        provisionFixtures({
          scenarioRoot,
          workspaceRoot,
          fixtures: {
            workspace: [{ source: 'fixtures/data.txt', target: '../outside.txt' }],
          },
        });

      // Assert
      await expect(action()).rejects.toBeInstanceOf(FixtureProvisionError);
    } finally {
      await rm(scenarioRoot, { recursive: true, force: true });
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
