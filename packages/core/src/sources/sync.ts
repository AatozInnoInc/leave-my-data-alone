// Sync pipeline for external prompt sources.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createSourceAdapterRegistry } from './adapters/types.js';
import type { SourceAdapterRegistry, SourceSyncOutcome } from './adapters/types.js';
import { createSourceRegistry } from './registry.js';
import type { SourceDescriptor, SourceRegistry } from './registry.js';

export interface SourceSyncReport {
  readonly source: SourceDescriptor;
  readonly status: 'success' | 'failure';
  readonly message?: string;
  readonly outputDir: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

export interface SourceSyncSummary {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly durationMs: number;
}

export interface SourceSyncResult {
  readonly reports: readonly SourceSyncReport[];
  readonly summary: SourceSyncSummary;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

export interface SourceSyncOptions {
  readonly rootDir: string;
  readonly sourceIds?: readonly string[];
  readonly registry?: SourceRegistry;
  readonly adapters?: SourceAdapterRegistry;
}

export class UnknownSourceError extends Error {
  public readonly sourceIds: readonly string[];

  constructor(sourceIds: readonly string[]) {
    super(`Unknown sources: ${sourceIds.join(', ')}`);
    this.name = 'UnknownSourceError';
    this.sourceIds = sourceIds;
  }
}

const selectSources = (
  registry: SourceRegistry,
  sourceIds: readonly string[] | undefined,
): readonly SourceDescriptor[] => {
  if (sourceIds === undefined || sourceIds.length === 0) {
    return registry.list();
  }

  const selected: SourceDescriptor[] = [];
  const missing: string[] = [];

  for (const id of sourceIds) {
    const source = registry.getById(id);
    if (source === undefined) {
      missing.push(id);
    } else {
      selected.push(source);
    }
  }

  if (missing.length > 0) {
    throw new UnknownSourceError(missing);
  }

  return selected;
};

const createFailureReport = (
  source: SourceDescriptor,
  outputDir: string,
  message: string,
  startedAt: Date,
  finishedAt: Date,
): SourceSyncReport => ({
  source,
  status: 'failure',
  message,
  outputDir,
  startedAt,
  finishedAt,
});

const syncSource = async (
  source: SourceDescriptor,
  outputRoot: string,
  adapters: SourceAdapterRegistry,
): Promise<SourceSyncReport> => {
  const adapter = adapters.getById(source.id);
  const outputDir = join(outputRoot, source.id);
  const startedAt = new Date();

  if (adapter === undefined) {
    const finishedAt = new Date();
    return createFailureReport(
      source,
      outputDir,
      'No adapter registered for source.',
      startedAt,
      finishedAt,
    );
  }

  await mkdir(outputDir, { recursive: true });

  let outcome: SourceSyncOutcome;
  try {
    outcome = await adapter.sync({ source, outputDir });
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return createFailureReport(source, outputDir, message, startedAt, finishedAt);
  }

  const finishedAt = new Date();

  return {
    source,
    status: outcome.status,
    message: outcome.message,
    outputDir,
    startedAt,
    finishedAt,
  };
};

const createSummary = (
  reports: readonly SourceSyncReport[],
  startedAt: Date,
  finishedAt: Date,
): SourceSyncSummary => {
  const total = reports.length;
  let succeeded = 0;

  for (const report of reports) {
    if (report.status === 'success') {
      succeeded += 1;
    }
  }

  return {
    total,
    succeeded,
    failed: total - succeeded,
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  };
};

/**
 * Syncs all configured sources using adapter implementations.
 */
export const syncSources = async (options: SourceSyncOptions): Promise<SourceSyncResult> => {
  const registry = options.registry ?? createSourceRegistry();
  const adapters = options.adapters ?? createSourceAdapterRegistry();
  const sources = selectSources(registry, options.sourceIds);
  const startedAt = new Date();

  await mkdir(options.rootDir, { recursive: true });

  const reports: SourceSyncReport[] = [];

  for (const source of sources) {
    const report = await syncSource(source, options.rootDir, adapters);
    reports.push(report);
  }

  const finishedAt = new Date();

  return {
    reports,
    summary: createSummary(reports, startedAt, finishedAt),
    startedAt,
    finishedAt,
  };
};
