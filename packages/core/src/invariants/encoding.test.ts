import { describe, expect, it } from 'vitest';

import {
  containsEncodedValue,
  encodeBase64Variants,
  encodeHexVariants,
  encodeZeroWidthVariants,
} from './encoding.js';

describe('encoding helpers', () => {
  it('should provide base64 variants', (): void => {
    const variants = encodeBase64Variants('test');

    expect(variants).toContain('dGVzdA==');
    expect(variants).toContain('dGVzdA');
  });

  it('should provide hex variants', (): void => {
    const variants = encodeHexVariants('test');

    expect(variants).toContain('74657374');
    expect(variants).toContain('74657374'.toUpperCase());
  });

  it('should detect base64-encoded content', (): void => {
    const secret = 'CANARY';
    const [variant] = encodeBase64Variants(secret);

    if (variant) {
      expect(containsEncodedValue(`prefix ${variant} suffix`, secret, 'base64')).toBe(true);
    } else {
      throw new Error('Expected base64 variant.');
    }
  });

  it('should detect zero-width encoded content', (): void => {
    const secret = 'A';
    const [variant] = encodeZeroWidthVariants(secret);

    if (variant) {
      expect(containsEncodedValue(`x${variant}y`, secret, 'zero_width')).toBe(true);
    } else {
      throw new Error('Expected zero-width variant.');
    }
  });
});
