// Fixture provisioning for scenario workspaces.

import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import type { CanaryFixture, FixturesConfig, WorkspaceFixture } from '../scenario/types.js';

export interface FixtureProvisionerOptions {
  readonly scenarioRoot: string;
  readonly workspaceRoot: string;
  readonly fixtures?: FixturesConfig;
}

export interface ProvisionedWorkspaceFixture {
  readonly source: string;
  readonly target: string;
}

export interface FixtureProvisioningResult {
  readonly canaries: readonly CanaryFixture[];
  readonly workspace: readonly ProvisionedWorkspaceFixture[];
}

export class FixtureProvisionError extends Error {
  public readonly source: string;
  public readonly target: string;

  constructor(source: string, target: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FixtureProvisionError';
    this.source = source;
    this.target = target;
  }
}

const resolveTargetPath = (workspaceRoot: string, target: string): string => {
  const normalizedTarget = target.startsWith('~') ? target.slice(1) : target;
  const trimmedTarget = normalizedTarget.replace(/^\/+/u, '');
  const resolved = resolve(workspaceRoot, trimmedTarget);
  const isWithinWorkspace =
    resolved === workspaceRoot || resolved.startsWith(`${workspaceRoot}${sep}`);

  if (isWithinWorkspace) {
    return resolved;
  }

  throw new FixtureProvisionError(
    '<resolved>',
    target,
    `Fixture target "${target}" escapes the workspace root.`,
  );
};

const provisionWorkspaceFixture = async (
  fixture: WorkspaceFixture,
  scenarioRoot: string,
  workspaceRoot: string,
): Promise<ProvisionedWorkspaceFixture> => {
  const sourcePath = resolve(scenarioRoot, fixture.source);
  const targetPath = resolveTargetPath(workspaceRoot, fixture.target);

  await mkdir(dirname(targetPath), { recursive: true });

  try {
    await cp(sourcePath, targetPath, { recursive: true });
  } catch (error) {
    throw new FixtureProvisionError(
      fixture.source,
      fixture.target,
      'Failed to provision workspace fixture.',
      { cause: error },
    );
  }

  return {
    source: sourcePath,
    target: targetPath,
  };
};

/**
 * Provisions scenario fixtures into a workspace root.
 */
export const provisionFixtures = async (
  options: FixtureProvisionerOptions,
): Promise<FixtureProvisioningResult> => {
  const fixtures = options.fixtures;
  const canaries = fixtures?.canaries ?? [];
  const workspaceFixtures = fixtures?.workspace ?? [];

  const provisionedWorkspace: ProvisionedWorkspaceFixture[] = [];

  for (const fixture of workspaceFixtures) {
    const provisioned = await provisionWorkspaceFixture(
      fixture,
      options.scenarioRoot,
      options.workspaceRoot,
    );
    provisionedWorkspace.push(provisioned);
  }

  return {
    canaries,
    workspace: provisionedWorkspace,
  };
};
