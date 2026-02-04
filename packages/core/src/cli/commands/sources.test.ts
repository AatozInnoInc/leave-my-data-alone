import { describe, expect, it } from 'vitest';

import type { SourceDescriptor, SourceRegistry } from '../../sources/registry.js';
import { createSourcesCommand, listSources } from './sources.js';

const createRegistry = (sources: readonly SourceDescriptor[]): SourceRegistry => ({
  list: () => [...sources],
  getById: (id: string) => sources.find((source) => source.id === id),
});

describe('listSources', () => {
  it('should list sources from the registry', (): void => {
    const registry = createRegistry([
      {
        id: 'example',
        name: 'Example Source',
        description: 'Example',
        homepage: 'https://example.com',
        tier: 'tier1',
      },
    ]);

    const sources = listSources(registry);

    expect(sources).toHaveLength(1);
  });
});

describe('createSourcesCommand', () => {
  it('should register a sources command', (): void => {
    const registry = createRegistry([]);
    const command = createSourcesCommand(registry);

    expect(command.name()).toBe('sources');
  });
});
