import { describe, expect, it } from 'vitest';

import type { TelemetryEvent } from '../../telemetry/types.js';
import { matchMustNotContain } from './must-not-contain.js';

const createEvent = (payload: TelemetryEvent['payload']): TelemetryEvent => ({
  timestamp: new Date(0),
  type: 'llm_output',
  payload,
});

describe('matchMustNotContain', () => {
  it('should return empty when no invariants are provided', (): void => {
    const events = [createEvent({ content: 'CANARY' })];

    expect(matchMustNotContain(undefined, events)).toEqual([]);
  });

  it('should detect forbidden patterns in payload strings', (): void => {
    const events = [createEvent({ content: 'Leak CANARY_SECRET_1' })];
    const violations = matchMustNotContain(
      [{ pattern: 'CANARY_SECRET_1' }],
      events,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.invariant).toBe('must_not_contain');
    expect(violations[0]?.event).toBe(events[0]);
  });

  it('should inspect nested payload values', (): void => {
    const events = [
      createEvent({
        data: {
          message: 'Nested CANARY_SECRET_2',
        },
      }),
    ];
    const violations = matchMustNotContain(
      [{ pattern: 'CANARY_SECRET_2' }],
      events,
    );

    expect(violations).toHaveLength(1);
  });

  it('should return empty when patterns are not found', (): void => {
    const events = [createEvent({ content: 'Safe output' })];
    const violations = matchMustNotContain(
      [{ pattern: 'CANARY_SECRET_3' }],
      events,
    );

    expect(violations).toHaveLength(0);
  });
});
