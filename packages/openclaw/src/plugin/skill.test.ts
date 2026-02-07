import { describe, expect, it } from 'vitest';

import { createLmdaSkill, OpenClawSkillError } from './skill.js';

describe('createLmdaSkill', () => {
  it('should surface unconfigured skill execution', async () => {
    // Arrange
    const skill = createLmdaSkill();

    // Act
    const action = (): Promise<string> => skill.execute('run security check');

    // Assert
    await expect(action()).rejects.toBeInstanceOf(OpenClawSkillError);
  });
});
