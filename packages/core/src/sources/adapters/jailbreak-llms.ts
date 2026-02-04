// Jailbreak LLMs source adapter.

import type { SourceAdapter, SourceSyncOutcome } from './types.js';
import type { Fetcher } from './github.js';
import { downloadGitHubArchive, writeSourceManifest } from './github.js';

export interface JailbreakLlmsAdapterOptions {
  readonly fetcher?: Fetcher;
  readonly ref?: string;
}

const DEFAULT_REF = 'main';

/**
 * Creates the jailbreak_llms adapter for syncing prompt data.
 */
export const createJailbreakLlmsAdapter = (
  options: JailbreakLlmsAdapterOptions = {},
): SourceAdapter => ({
  id: 'jailbreak_llms',
  sync: async ({ source, outputDir }): Promise<SourceSyncOutcome> => {
    const downloadOptions = {
      repo: {
        owner: 'verazuo',
        repo: 'jailbreak_llms',
        ref: options.ref ?? DEFAULT_REF,
      },
      outputDir,
      filename: 'jailbreak-llms.tar.gz',
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
