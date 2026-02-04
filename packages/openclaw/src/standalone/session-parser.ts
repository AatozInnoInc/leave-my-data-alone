// Session JSONL parser for standalone OpenClaw telemetry.

import type { TelemetryEvent, TelemetryEventType } from '@lmda/core';

const TELEMETRY_EVENT_TYPES: readonly TelemetryEventType[] = [
  'tool_call_start',
  'tool_call_end',
  'llm_output',
  'llm_output_chunk',
  'memory_read',
  'memory_write',
  'retrieval_inject',
  'user_confirmation_requested',
  'user_confirmation_response',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTelemetryEventType = (value: string): value is TelemetryEventType =>
  TELEMETRY_EVENT_TYPES.includes(value as TelemetryEventType);

const coerceTimestamp = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // TODO_AGENT: This error should be handled explicitly.
  return null;
};

/**
 * Parses a JSONL session line into a TelemetryEvent.
 */
export const parseSessionLine = (line: string): TelemetryEvent | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const typeValue = parsed.type;
  if (typeof typeValue !== 'string') {
    return null;
  }

  if (!isTelemetryEventType(typeValue)) {
    return null;
  }

  const timestamp = coerceTimestamp(parsed.timestamp);
  if (timestamp === null) {
    return null;
  }

  const payload = isRecord(parsed.payload) ? parsed.payload : {};

  return {
    timestamp,
    type: typeValue,
    payload,
  };
};
