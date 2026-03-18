import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SourceDescriptor } from '../registry.js';
import type { Fetcher, FetchResponse } from './github.js';
import { createAwesomeJailbreakAdapter } from './awesome-jailbreak.js';

const createFetcher = (data: Uint8Array): Fetcher =>
  (_url: string): Promise<FetchResponse> =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: (): Promise<ArrayBuffer> =>
        Promise.resolve(data.buffer.slice(0) as ArrayBuffer),
    });
const createFetcher = (data: Uint8Array): Fetcher => () =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: (): Promise<ArrayBuffer> =>
      Promise.resolve(data.buffer.slice(0) as ArrayBuffer),
  });

describe('createAwesomeJailbreakAdapter', () => {
  it('should sync the source and write a manifest', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-aj-'));
    const source: SourceDescriptor = {
      id: 'awesome-jailbreak',
      name: 'Awesome Jailbreak',
      description: 'Test data',
      homepage: 'https://example.com',
      tier: 'tier1',
    };

    try {
      const adapter = createAwesomeJailbreakAdapter({
        fetcher: createFetcher(new TextEncoder().encode('archive')),
      });

      const result = await adapter.sync({ source, outputDir: tempDir });

      expect(result.status).toBe('success');

      const manifestPath = join(tempDir, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        source: { id: string };
        archivePath: string;
      };

      expect(manifest.source.id).toBe('awesome-jailbreak');

      const archiveStats = await stat(manifest.archivePath);
      expect(archiveStats.isFile()).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
