// Matcher for must_not_contain invariants.

import type { MustNotContainInvariant } from '../../scenario/types.js';
import type { TelemetryEvent } from '../../telemetry/types.js';
import { getPayloadStrings } from '../payload-strings.js';
import type { Violation } from '../types.js';

/**
 * Returns violations for any telemetry payload strings containing forbidden patterns.
 */
export const matchMustNotContain = (
  invariants: readonly MustNotContainInvariant[] | undefined,
  events: readonly TelemetryEvent[],
): Violation[] => {
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }

  const violations: Violation[] = [];

  for (const event of events) {
    const payloadStrings = getPayloadStrings(event);

    for (const invariant of invariants) {
      if (payloadStrings.some((value) => value.includes(invariant.pattern))) {
        violations.push({
          invariant: 'must_not_contain',
          event,
          details: `Pattern "${invariant.pattern}" found in telemetry payload.`,
        });
      }
    }
  }

  return violations;
};
