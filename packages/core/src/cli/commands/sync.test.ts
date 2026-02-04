import { describe, expect, it } from 'vitest';

import { createSyncCommand } from './sync.js';

describe('createSyncCommand', () => {
  it('should register a sync command', (): void => {
    const command = createSyncCommand();

    expect(command.name()).toBe('sync');
  });
});
