// GitHub download helpers for source adapters.

import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SourceDescriptor } from '../registry.js';

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type Fetcher = (
  url: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<FetchResponse>;

export interface GitHubRepoReference {
  readonly owner: string;
  readonly repo: string;
  readonly ref?: string;
}

export interface GitHubArchiveDownloadOptions {
  readonly repo: GitHubRepoReference;
  readonly outputDir: string;
  readonly filename?: string;
  readonly fetcher?: Fetcher;
}

export interface GitHubArchiveDownloadResult {
  readonly url: string;
  readonly archivePath: string;
}

export interface SourceManifest {
  readonly source: SourceDescriptor;
  readonly archiveUrl: string;
  readonly archivePath: string;
  readonly syncedAt: string;
}

export class GitHubDownloadError extends Error {
  public readonly url: string;

  constructor(url: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GitHubDownloadError';
    this.url = url;
  }
}

const DEFAULT_REF = 'main';

/**
 * Strips characters that are unsafe for filesystem paths and URLs.
 */
const sanitizeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '');

/**
 * Builds the GitHub archive URL for a repository.
 */
export const buildGitHubArchiveUrl = (repo: GitHubRepoReference): string => {
  const ref = repo.ref ?? DEFAULT_REF;
  return `https://codeload.github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tar.gz/${encodeURIComponent(ref)}`;
};

const resolveFetcher = (fetcher: Fetcher | undefined): Fetcher => {
  if (fetcher !== undefined) {
    return fetcher;
  }

  const globalFetcher = globalThis.fetch;
  if (typeof globalFetcher === 'function') {
    return globalFetcher as Fetcher;
  }

  throw new GitHubDownloadError('unknown', 'Global fetch is not available.');
};

/**
 * Downloads a GitHub repository archive into the output directory.
 */
export const downloadGitHubArchive = async (
  options: GitHubArchiveDownloadOptions,
): Promise<GitHubArchiveDownloadResult> => {
  const archiveUrl = buildGitHubArchiveUrl(options.repo);
  const fetcher = resolveFetcher(options.fetcher);

  const response = await fetcher(archiveUrl, {
    headers: {
      'user-agent': 'lmda',
    },
  });

  // Early throw; negative check allowed per style guide.
  if (!response.ok) {
    throw new GitHubDownloadError(
      archiveUrl,
      `Failed to download archive (${String(response.status)} ${response.statusText}).`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const ref = options.repo.ref ?? DEFAULT_REF;
  const filename =
    options.filename ??
    `${sanitizeSegment(options.repo.owner)}-${sanitizeSegment(options.repo.repo)}-${sanitizeSegment(ref)}.tar.gz`;
  const archivePath = join(options.outputDir, filename);

  await writeFile(archivePath, buffer);

  return {
    url: archiveUrl,
    archivePath,
  };
};

/**
 * Writes a manifest file describing the synced source.
 */
export const writeSourceManifest = async (
  outputDir: string,
  manifest: SourceManifest,
): Promise<string> => {
  const manifestPath = join(outputDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifestPath;
};
