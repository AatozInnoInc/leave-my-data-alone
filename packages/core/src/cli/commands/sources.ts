// CLI command for listing external prompt sources.

import { Command } from 'commander';

import type { SourceDescriptor, SourceRegistry } from '../../sources/registry.js';
import { createSourceRegistry } from '../../sources/registry.js';

const formatSource = (source: SourceDescriptor): string =>
  `${source.id} [${source.tier}] - ${source.name} :: ${source.homepage}`;

/**
 * Lists sources from the registry.
 */
export const listSources = (registry: SourceRegistry): readonly SourceDescriptor[] =>
  registry.list();

/**
 * Builds the sources command.
 */
export const createSourcesCommand = (
  registry: SourceRegistry = createSourceRegistry(),
): Command => {
  const command = new Command('sources');

  command.description('List external prompt sources configured for LMDA.');
  command.action(() => {
    const sources = listSources(registry);

    if (sources.length > 0) {
      for (const source of sources) {
        console.log(formatSource(source));
      }
    } else {
      console.log('No sources registered.');
    }
  });

  return command;
};
