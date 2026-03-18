// Matcher for must_not_call invariants.

import type { ArgumentMatch, MustNotCallInvariant, PatternMatch } from '../../scenario/types.js';
import type { TelemetryEvent } from '../../telemetry/types.js';
import { isObject } from '../../shared/type-guards.js';
import type { Violation } from '../types.js';

const isPatternMatch = (value: unknown): value is PatternMatch => {
  if (!isObject(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.pattern === 'string' && Object.keys(record).length === 1;
};

const matchArgument = (expected: ArgumentMatch, actual: unknown): boolean => {
  if (expected === null || typeof expected !== 'object') {
    return Object.is(expected, actual);
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return false;
    }

    return expected.every((entry: ArgumentMatch, index: number) =>
      matchArgument(entry, actual[index]),
    );
    const expectedEntries = expected as readonly ArgumentMatch[];
    const actualEntries = actual as readonly unknown[];
    return expectedEntries.every((entry, index) => matchArgument(entry, actualEntries[index]));
  }

  if (isPatternMatch(expected)) {
    if (typeof actual !== 'string') {
      return false;
    }

    try {
      return new RegExp(expected.pattern).test(actual);
    } catch {
      return false;
    }
  }

  if (!isObject(actual) || Array.isArray(actual)) {
    return false;
  }

  const expectedRecord = expected as Record<string, ArgumentMatch>;
  const actualRecord = actual as Record<string, unknown>;

  return Object.entries(expectedRecord).every(([key, value]) => {
    if (!(key in actualRecord)) {
      return false;
    }

    return matchArgument(value, actualRecord[key]);
  });
};

const getToolCallPayload = (
  event: TelemetryEvent,
): { tool?: string; args?: unknown } | null => {
  if (event.type !== 'tool_call_start' && event.type !== 'tool_call_end') {
    return null;
  }

  if (!isObject(event.payload)) {
    return null;
  }

  const payload = event.payload as Record<string, unknown>;
  const tool = typeof payload.tool === 'string' ? payload.tool : undefined;
  const args = payload.args;

  return {
    ...(tool !== undefined && { tool }),
    ...(args !== undefined && { args }),
  };
};

/**
 * Returns violations for any tool calls that match forbidden tool/argument specs.
 */
export const matchMustNotCall = (
  invariants: readonly MustNotCallInvariant[] | undefined,
  events: readonly TelemetryEvent[],
): Violation[] => {
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }

  const violations: Violation[] = [];

  for (const event of events) {
    const payload = getToolCallPayload(event);
    if (!payload?.tool) {
      continue;
    }

    for (const invariant of invariants) {
      if (payload.tool !== invariant.tool) {
        continue;
      }

      if (invariant.args && !matchArgument(invariant.args, payload.args)) {
        continue;
      }

      violations.push({
        invariant: 'must_not_call',
        event,
        details: `Tool "${invariant.tool}" was called.`,
      });
    }
  }

  return violations;
};
