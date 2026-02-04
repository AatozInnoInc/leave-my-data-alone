// Canary token generation utilities.

import { randomBytes } from 'node:crypto';

export interface CanaryToken {
  readonly id: string;
  readonly value: string;
}

export interface CanaryGenerationOptions {
  readonly id: string;
  readonly prefix?: string;
  readonly entropyBytes?: number;
}

const DEFAULT_PREFIX = 'CANARY';
const DEFAULT_ENTROPY_BYTES = 8;

const resolvePrefix = (prefix: string | undefined): string => {
  if (typeof prefix === 'string' && prefix.trim().length > 0) {
    return prefix.trim();
  }

  return DEFAULT_PREFIX;
};

const resolveEntropyBytes = (entropyBytes: number | undefined): number => {
  if (typeof entropyBytes === 'number' && Number.isFinite(entropyBytes) && entropyBytes >= 1) {
    return Math.floor(entropyBytes);
  }

  return DEFAULT_ENTROPY_BYTES;
};

const normalizeId = (id: string): string => {
  const trimmed = id.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  throw new Error('Canary id must be a non-empty string.');
};

/**
 * Generates a canary token with a randomized suffix.
 */
export const generateCanary = (options: CanaryGenerationOptions): CanaryToken => {
  const id = normalizeId(options.id);
  const prefix = resolvePrefix(options.prefix);
  const entropyBytes = resolveEntropyBytes(options.entropyBytes);
  const entropy = randomBytes(entropyBytes).toString('hex');

  return {
    id,
    value: `${prefix}_${id}_${entropy}`,
  };
};
