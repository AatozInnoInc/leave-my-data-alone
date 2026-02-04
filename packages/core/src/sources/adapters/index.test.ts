import { describe, expect, it } from 'vitest';

import { createDefaultSourceAdapterRegistry } from './index.js';

describe('createDefaultSourceAdapterRegistry', () => {
  it('should register tier1 adapters', (): void => {
    const registry = createDefaultSourceAdapterRegistry();
    const ids = registry.list().map((adapter) => adapter.id);

    expect(ids).toContain('jailbreakbench');
    expect(ids).toContain('awesome-jailbreak');
    expect(ids).toContain('jailbreak_llms');
  });
});
