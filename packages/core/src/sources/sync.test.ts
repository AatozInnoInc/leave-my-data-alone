import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createSourceAdapterRegistry } from './adapters/types.js';
import { createSourceRegistry } from './registry.js';
import { syncSources, UnknownSourceError } from './sync.js';

describe('syncSources', () => {
  it('should sync sources with registered adapters', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-sync-'));

    try {
      const registry = createSourceRegistry([
        {
          id: 'example',
          name: 'Example Source',
          description: 'Example',
          homepage: 'https://example.com',
          tier: 'tier1',
        },
      ]);

      const adapters = createSourceAdapterRegistry([
        {
          id: 'example',
          sync: async ({ outputDir }) => {
            await writeFile(join(outputDir, 'marker.txt'), 'ok', 'utf8');
            return { status: 'success' };
          },
        },
      ]);

      const result = await syncSources({
        rootDir: tempDir,
        registry,
        adapters,
      });

      expect(result.summary.total).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.reports[0]?.status).toBe('success');

      const outputDir = result.reports[0]?.outputDir;
      if (outputDir === undefined) {
        throw new Error('Expected output directory.');
      }

      const stats = await stat(outputDir);
      expect(stats.isDirectory()).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should report failures for missing adapters', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-sync-'));

    try {
      const registry = createSourceRegistry([
        {
          id: 'missing-adapter',
          name: 'Missing Adapter',
          description: 'Example',
          homepage: 'https://example.com',
          tier: 'tier1',
        },
      ]);

      const result = await syncSources({
        rootDir: tempDir,
        registry,
      });

      expect(result.summary.total).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.reports[0]?.status).toBe('failure');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw when a source id is unknown', async (): Promise<void> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lmda-sync-'));

    try {
      const registry = createSourceRegistry([]);

      await expect(
        syncSources({
          rootDir: tempDir,
          registry,
          sourceIds: ['unknown'],
        }),
      ).rejects.toBeInstanceOf(UnknownSourceError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
