import { describe, expect, it } from 'vitest';

import { isObject } from './type-guards.js';

describe('isObject', () => {
  it('should return false for null and primitives', (): void => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('text')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(false)).toBe(false);
  });

  it('should return true for objects and arrays', (): void => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
  });

  it('should return false for functions', (): void => {
    expect(isObject(() => undefined)).toBe(false);
  });
});
