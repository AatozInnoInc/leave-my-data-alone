// Extracts payload strings for invariant matching.

import type { TelemetryEvent } from '../telemetry/types.js';
import { isObject } from '../shared/type-guards.js';

const collectStrings = (value: unknown, seen: Set<unknown>): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  // Early exit for non-objects
  if (!isObject(value)) {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry, seen));
  }

  return Object.values(value as Record<string, unknown>).flatMap((entry) =>
    collectStrings(entry, seen),
  );
};

/**
 * Collects all string values from a telemetry payload, including nested structures.
 */
export const getPayloadStrings = (event: TelemetryEvent): readonly string[] =>
  collectStrings(event.payload, new Set());
