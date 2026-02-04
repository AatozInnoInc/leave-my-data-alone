import { describe, expect, it } from 'vitest';

import { createSourceRegistry } from './registry.js';

describe('createSourceRegistry', () => {
  it('should return default sources', (): void => {
    const registry = createSourceRegistry();
    const sources = registry.list();

    expect(sources.length).toBeGreaterThan(0);
  });

  it('should look up a source by id', (): void => {
    const registry = createSourceRegistry();
    const source = registry.getById('jailbreakbench');
    const jailbreakLlms = registry.getById('jailbreak_llms');

    expect(source?.id).toBe('jailbreakbench');
    expect(jailbreakLlms?.id).toBe('jailbreak_llms');
  });
});
