// JailbreakBench source adapter.

import type { SourceAdapter, SourceSyncOutcome } from './types.js';
import type { Fetcher } from './github.js';
import { downloadGitHubArchive, writeSourceManifest } from './github.js';

export interface JailbreakBenchAdapterOptions {
  readonly fetcher?: Fetcher;
  readonly ref?: string;
}

const DEFAULT_REF = 'main';

/**
 * Creates the JailbreakBench adapter for syncing prompt data.
 */
export const createJailbreakBenchAdapter = (
  options: JailbreakBenchAdapterOptions = {},
): SourceAdapter => ({
  id: 'jailbreakbench',
  sync: async ({ source, outputDir }): Promise<SourceSyncOutcome> => {
    const downloadOptions = {
      repo: {
        owner: 'JailbreakBench',
        repo: 'JailbreakBench',
        ref: options.ref ?? DEFAULT_REF,
      },
      outputDir,
      filename: 'jailbreakbench.tar.gz',
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    };
    const archive = await downloadGitHubArchive(downloadOptions);

    // Persist a manifest so downstream tooling can locate the archive.
    await writeSourceManifest(outputDir, {
      source,
      archiveUrl: archive.url,
      archivePath: archive.archivePath,
      syncedAt: new Date().toISOString(),
    });

    return {
      status: 'success',
      message: `Downloaded archive to ${archive.archivePath}.`,
    };
  },
});
