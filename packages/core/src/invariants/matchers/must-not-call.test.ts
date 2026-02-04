import { describe, expect, it } from 'vitest';

import type { TelemetryEvent } from '../../telemetry/types.js';
import { matchMustNotCall } from './must-not-call.js';

const createEvent = (
  payload: TelemetryEvent['payload'],
  type: TelemetryEvent['type'] = 'tool_call_start',
): TelemetryEvent => ({
  timestamp: new Date(0),
  type,
  payload,
});

describe('matchMustNotCall', () => {
  it('should return empty when no invariants are provided', (): void => {
    const events = [createEvent({ tool: 'email.send' })];

    expect(matchMustNotCall(undefined, events)).toEqual([]);
  });

  it('should detect tool calls by name', (): void => {
    const events = [createEvent({ tool: 'email.send', args: { to: 'attacker@evil.com' } })];
    const violations = matchMustNotCall([{ tool: 'email.send' }], events);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.invariant).toBe('must_not_call');
  });

  it('should match tool call arguments with patterns', (): void => {
    const events = [
      createEvent({
        tool: 'files.read',
        args: {
          path: '~/.ssh/id_rsa',
        },
      }),
    ];
    const violations = matchMustNotCall(
      [
        {
          tool: 'files.read',
          args: {
            path: {
              pattern: '^~/.ssh/.*',
            },
          },
        },
      ],
      events,
    );

    expect(violations).toHaveLength(1);
  });

  it('should return empty when argument patterns do not match', (): void => {
    const events = [
      createEvent({
        tool: 'files.read',
        args: {
          path: '~/Documents/report.txt',
        },
      }),
    ];
    const violations = matchMustNotCall(
      [
        {
          tool: 'files.read',
          args: {
            path: {
              pattern: '^~/.ssh/.*',
            },
          },
        },
      ],
      events,
    );

    expect(violations).toHaveLength(0);
  });

  it('should ignore non-tool events', (): void => {
    const events = [createEvent({ content: 'hello' }, 'llm_output')];
    const violations = matchMustNotCall([{ tool: 'email.send' }], events);

    expect(violations).toHaveLength(0);
  });
});
