// Matcher for must_not_encode invariants.

import type { MustNotEncodeInvariant } from '../../scenario/types.js';
import type { TelemetryEvent } from '../../telemetry/types.js';
import { containsEncodedValue } from '../encoding.js';
import { getPayloadStrings } from '../payload-strings.js';
import type { Violation } from '../types.js';

const resolveCandidates = (
  invariant: MustNotEncodeInvariant,
  candidateValues: readonly string[],
): readonly string[] => invariant.of ?? candidateValues;

/**
 * Returns violations for any telemetry payloads containing encoded sensitive values.
 */
export const matchMustNotEncode = (
  invariants: readonly MustNotEncodeInvariant[] | undefined,
  events: readonly TelemetryEvent[],
  candidateValues: readonly string[],
): Violation[] => {
  // Negative checks are appropriate for early exits.
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }

  const violations: Violation[] = [];

  for (const event of events) {
    // Extract payload strings once per event to avoid repeated traversal.
    const payloadStrings = getPayloadStrings(event);

    for (const invariant of invariants) {
      // Use invariant-specific targets when provided, otherwise fall back to scenario candidates.
      const candidates = resolveCandidates(invariant, candidateValues);
      if (candidates.length === 0) {
        continue;
      }

      for (const candidate of candidates) {
        if (
          payloadStrings.some((content) =>
            containsEncodedValue(content, candidate, invariant.type),
          )
        ) {
          violations.push({
            invariant: 'must_not_encode',
            event,
            details: `Encoded value detected for type "${invariant.type}".`,
          });
        }
      }
    }
  }

  return violations;
};
