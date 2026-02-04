import { describe, expect, it } from 'vitest';

import { buildCli } from './index.js';

describe('buildCli', () => {
  it('should register the validate command', (): void => {
    const program = buildCli();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain('validate');
  });
});
