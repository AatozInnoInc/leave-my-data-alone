import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Fetcher, FetchResponse } from './github.js';
import {
  buildGitHubArchiveUrl,
  downloadGitHubArchive,
  GitHubDownloadError,
  writeSourceManifest,
} from './github.js';

const createFetcher = (ok: boolean, data: Uint8Array): Fetcher =>
  (): Promise<FetchResponse> =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 404,
      statusText: ok ? 'OK' : 'Not Found',
      arrayBuffer: (): Promise<ArrayBuffer> =>
        Promise.resolve(data.buffer.slice(0) as ArrayBuffer),
    });

describe('buildGitHubArchiveUrl', () => {
  it('should build a default archive URL', (): void => {
    const url = buildGitHubArchiveUrl({ owner: 'acme', repo: 'example' });

    expect(url).toBe('https://codeload.github.com/acme/example/tar.gz/main');
  });
});

describe('downloadGitHubArchive', () => {
  it('should write archive content to disk', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-github-'));
    const data = new TextEncoder().encode('archive');

    try {
      const result = await downloadGitHubArchive({
        repo: { owner: 'acme', repo: 'example', ref: 'main' },
        outputDir: tempDir,
        filename: 'archive.tar.gz',
        fetcher: createFetcher(true, data),
      });

      const stored = await readFile(result.archivePath, 'utf8');
      expect(stored).toBe('archive');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw when the download fails', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-github-'));
    const data = new TextEncoder().encode('error');

    try {
      await expect(
        downloadGitHubArchive({
          repo: { owner: 'acme', repo: 'example', ref: 'main' },
          outputDir: tempDir,
          fetcher: createFetcher(false, data),
        }),
      ).rejects.toBeInstanceOf(GitHubDownloadError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeSourceManifest', () => {
  it('should write a manifest file', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-manifest-'));

    try {
      const manifestPath = await writeSourceManifest(tempDir, {
        source: {
          id: 'example',
          name: 'Example Source',
          description: 'Example',
          homepage: 'https://example.com',
          tier: 'tier1',
        },
        archiveUrl: 'https://example.com/archive.tgz',
        archivePath: join(tempDir, 'archive.tgz'),
        syncedAt: new Date(0).toISOString(),
      });

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        source: { id: string };
      };

      expect(manifest.source.id).toBe('example');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
