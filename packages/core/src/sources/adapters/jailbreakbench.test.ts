import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SourceDescriptor } from '../registry.js';
import type { Fetcher } from './github.js';
import { createJailbreakBenchAdapter } from './jailbreakbench.js';

const createFetcher = (data: Uint8Array): Fetcher => async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  arrayBuffer: async () => data.buffer,
});

describe('createJailbreakBenchAdapter', () => {
  it('should sync the source and write a manifest', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-jb-'));
    const source: SourceDescriptor = {
      id: 'jailbreakbench',
      name: 'JailbreakBench',
      description: 'Test data',
      homepage: 'https://example.com',
      tier: 'tier1',
    };

    try {
      const adapter = createJailbreakBenchAdapter({
        fetcher: createFetcher(new TextEncoder().encode('archive')),
      });

      const result = await adapter.sync({ source, outputDir: tempDir });

      expect(result.status).toBe('success');

      const manifestPath = join(tempDir, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        source: { id: string };
        archivePath: string;
      };

      expect(manifest.source.id).toBe('jailbreakbench');

      const archiveStats = await stat(manifest.archivePath);
      expect(archiveStats.isFile()).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
