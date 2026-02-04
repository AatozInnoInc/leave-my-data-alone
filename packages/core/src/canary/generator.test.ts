import { describe, expect, it } from 'vitest';

import { generateCanary } from './generator.js';

describe('generateCanary', () => {
  it('should generate a canary with the default prefix', () => {
    // Arrange
    const prefix = 'CANARY_api_key_';

    // Act
    const result = generateCanary({ id: 'api_key', entropyBytes: 4 });

    // Assert
    expect(result.id).toBe('api_key');
    expect(result.value.startsWith(prefix)).toBe(true);

    const suffix = result.value.slice(prefix.length);
    expect(suffix.length).toBe(8);
    expect(/^[0-9a-f]+$/u.test(suffix)).toBe(true);
  });

  it('should generate a canary with a custom prefix', () => {
    // Arrange
    const prefix = 'LMDA_token_';

    // Act
    const result = generateCanary({ id: 'token', prefix: 'LMDA', entropyBytes: 2 });

    // Assert
    expect(result.value.startsWith(prefix)).toBe(true);

    const suffix = result.value.slice(prefix.length);
    expect(suffix.length).toBe(4);
    expect(/^[0-9a-f]+$/u.test(suffix)).toBe(true);
  });

  it('should throw when id is empty', () => {
    // Arrange
    const options = { id: '   ' };

    // Act
    const action = (): void => {
      generateCanary(options);
    };

    // Assert
    expect(action).toThrow('Canary id must be a non-empty string.');
  });
});
