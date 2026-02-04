// Shared type-guard helpers.

/**
 * Returns true when a value is not a non-null object.
 */
export const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;
