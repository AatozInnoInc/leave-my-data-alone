// Awesome Jailbreak on LLMs source adapter.

import type { SourceAdapter, SourceSyncOutcome } from './types.js';
import type { Fetcher } from './github.js';
import { downloadGitHubArchive, writeSourceManifest } from './github.js';

export interface AwesomeJailbreakAdapterOptions {
  readonly fetcher?: Fetcher;
  readonly ref?: string;
}

const DEFAULT_REF = 'main';

/**
 * Creates the Awesome Jailbreak adapter for syncing prompt data.
 */
export const createAwesomeJailbreakAdapter = (
  options: AwesomeJailbreakAdapterOptions = {},
): SourceAdapter => ({
  id: 'awesome-jailbreak',
  sync: async ({ source, outputDir }): Promise<SourceSyncOutcome> => {
    const downloadOptions = {
      repo: {
        owner: 'awesome-jailbreak',
        repo: 'awesome-jailbreak-on-llms',
        ref: options.ref ?? DEFAULT_REF,
      },
      outputDir,
      filename: 'awesome-jailbreak.tar.gz',
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
