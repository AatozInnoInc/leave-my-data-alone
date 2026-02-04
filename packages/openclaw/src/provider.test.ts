import { describe, expect, it } from 'vitest';

import { OpenClawProvider, OpenClawProviderError } from './provider.js';

describe('OpenClawProvider', () => {
  it('should reject empty workspace roots', () => {
    // Arrange
    const options = { mode: 'standalone' as const, workspaceRoot: '   ' };

    // Act
    const action = (): OpenClawProvider => new OpenClawProvider(options);

    // Assert
    expect(action).toThrow(OpenClawProviderError);
  });

  it('should surface standalone execution errors', async () => {
    // Arrange
    const provider = new OpenClawProvider({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
    });

    // Act
    const iterator = provider.execute([{ role: 'system', content: 'system-only' }]);

    // Assert
    await expect(iterator.next()).rejects.toBeInstanceOf(OpenClawProviderError);
  });

  it('should surface plugin execution errors', async () => {
    // Arrange
    const provider = new OpenClawProvider({
      mode: 'plugin',
      workspaceRoot: '/tmp/lmda',
    });

    // Act
    const iterator = provider.execute([]);

    // Assert
    await expect(iterator.next()).rejects.toBeInstanceOf(OpenClawProviderError);
  });
});
