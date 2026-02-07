// Shared type guards and coercions for standalone OpenClaw.

/**
 * True when value is a plain object (not null, array, or class instance).
 * Note: Date and RegExp pass this guard. Safe for JSON.parsed payloads; use with care elsewhere.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

export const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
