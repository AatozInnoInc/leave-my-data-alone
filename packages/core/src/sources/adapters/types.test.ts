import { describe, expect, it } from 'vitest';

import { createSourceAdapterRegistry } from './types.js';

describe('createSourceAdapterRegistry', () => {
  it('should list adapters', (): void => {
    const registry = createSourceAdapterRegistry([
      {
        id: 'example',
        sync: async () => ({ status: 'success' }),
      },
    ]);

    expect(registry.list()).toHaveLength(1);
  });

  it('should fetch adapters by id', (): void => {
    const registry = createSourceAdapterRegistry([
      {
        id: 'example',
        sync: async () => ({ status: 'success' }),
      },
    ]);

    const adapter = registry.getById('example');

    expect(adapter?.id).toBe('example');
  });
});
