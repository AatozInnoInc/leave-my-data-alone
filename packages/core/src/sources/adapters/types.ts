// Source adapter contracts for syncing external prompt sources.

import type { SourceDescriptor } from '../registry.js';

export type SourceSyncStatus = 'success' | 'failure';

export interface SourceSyncOutcome {
  readonly status: SourceSyncStatus;
  readonly message?: string;
}

export interface SourceSyncTarget {
  readonly source: SourceDescriptor;
  readonly outputDir: string;
}

export interface SourceAdapter {
  readonly id: string;
  sync(target: SourceSyncTarget): Promise<SourceSyncOutcome>;
}

export interface SourceAdapterRegistry {
  list(): readonly SourceAdapter[];
  getById(id: string): SourceAdapter | undefined;
}

/**
 * Creates a registry for source adapters.
 */
export const createSourceAdapterRegistry = (
  adapters: readonly SourceAdapter[] = [],
): SourceAdapterRegistry => ({
  list: () => [...adapters],
  getById: (id: string) => adapters.find((adapter) => adapter.id === id),
});
