// CLI command for syncing external prompt sources.

import { Command } from 'commander';

import type { SourceAdapterRegistry } from '../../sources/adapters/types.js';
import { createDefaultSourceAdapterRegistry } from '../../sources/adapters/index.js';
import type { SourceRegistry } from '../../sources/registry.js';
import { createSourceRegistry } from '../../sources/registry.js';
import { syncSources, UnknownSourceError } from '../../sources/sync.js';
import type { SourceSyncReport, SourceSyncResult } from '../../sources/sync.js';

const formatDuration = (report: SourceSyncReport): string => {
  const duration = report.finishedAt.getTime() - report.startedAt.getTime();
  return `${String(Math.max(0, duration))}ms`;
};

const formatReportLine = (report: SourceSyncReport): string => {
  const label = report.status === 'success' ? 'OK' : 'FAIL';
  return `[${label}] ${report.source.id} -> ${report.outputDir} (${formatDuration(report)})`;
};

const printSummary = (result: SourceSyncResult): void => {
  console.log(
    `Synced ${String(result.summary.total)} sources: ${String(result.summary.succeeded)} succeeded, ${String(result.summary.failed)} failed (${String(result.summary.durationMs)}ms).`,
  );
};

const printReports = (reports: readonly SourceSyncReport[]): void => {
  for (const report of reports) {
    console.log(formatReportLine(report));

    if (report.status === 'failure' && report.message !== undefined) {
      console.error(`  - ${report.message}`);
    }
  }
};

/**
 * Builds the sync command.
 */
export const createSyncCommand = (
  registry: SourceRegistry = createSourceRegistry(),
  adapters: SourceAdapterRegistry = createDefaultSourceAdapterRegistry(),
): Command => {
  const command = new Command('sync');

  command
    .description('Sync external prompt sources into a local directory.')
    .option('-d, --dir <dir>', 'Directory to write synced sources', 'sources')
    .option('--source <id...>', 'Source ids to sync (defaults to all sources)')
    .action(async (): Promise<void> => {
      const options = command.opts<{ dir: string; source?: string[] }>();
      const sourceIds = options.source;

      try {
        const syncOptions = {
          rootDir: options.dir,
          registry,
          adapters,
          ...(sourceIds ? { sourceIds } : {}),
        };
        const result = await syncSources(syncOptions);

        if (result.reports.length > 0) {
          printReports(result.reports);
        }

        printSummary(result);

        if (result.summary.failed > 0) {
          process.exitCode = 1;
        }
      } catch (error) {
        if (error instanceof UnknownSourceError) {
          console.error(error.message);
          process.exitCode = 1;
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error.';
        console.error(message);
        process.exitCode = 1;
      }
    });

  return command;
};
