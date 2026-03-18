// Default source adapter registry.

import { createAwesomeJailbreakAdapter } from './awesome-jailbreak.js';
import type { Fetcher } from './github.js';
import { createJailbreakBenchAdapter } from './jailbreakbench.js';
import { createJailbreakLlmsAdapter } from './jailbreak-llms.js';
import { createSourceAdapterRegistry } from './types.js';
import type { SourceAdapterRegistry } from './types.js';

export interface DefaultAdapterOptions {
  readonly fetcher?: Fetcher;
}

/**
 * Creates a registry with the default Tier 1 adapters.
 */
const adapterOptions = (fetcher: Fetcher | undefined): { fetcher?: Fetcher } =>
const adapterOptions = (fetcher: Fetcher | undefined): DefaultAdapterOptions =>
  fetcher !== undefined ? { fetcher } : {};

export const createDefaultSourceAdapterRegistry = (
  options: DefaultAdapterOptions = {},
): SourceAdapterRegistry =>
  createSourceAdapterRegistry([
    createJailbreakBenchAdapter(adapterOptions(options.fetcher)),
    createAwesomeJailbreakAdapter(adapterOptions(options.fetcher)),
    createJailbreakLlmsAdapter(adapterOptions(options.fetcher)),
  ]);
