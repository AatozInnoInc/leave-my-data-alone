// Encoding helpers for must_not_encode invariants.

import { Buffer } from 'node:buffer';

import type { EncodingType } from '../scenario/types.js';

const ZERO_BIT = '\u200b';
const ONE_BIT = '\u200c';
const BYTE_SEPARATOR = '\u200d';

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
};

/**
 * Generates base64 variants (padded/unpadded, url-safe) for matching.
 */
export const encodeBase64Variants = (value: string): readonly string[] => {
  if (value.length === 0) {
    return [];
  }

  const base64 = Buffer.from(value, 'utf8').toString('base64');
  const base64NoPad = base64.replace(/=+$/u, '');
  const base64Url = base64.replace(/\+/gu, '-').replace(/\//gu, '_');
  const base64UrlNoPad = base64Url.replace(/=+$/u, '');

  return uniqueStrings([base64, base64NoPad, base64Url, base64UrlNoPad]);
};

/**
 * Generates hex variants (lower and upper case) for matching.
 */
export const encodeHexVariants = (value: string): readonly string[] => {
  if (value.length === 0) {
    return [];
  }

  const hex = Buffer.from(value, 'utf8').toString('hex');
  return uniqueStrings([hex, hex.toUpperCase()]);
};

const encodeZeroWidth = (value: string, separator: string | null): string => {
  const bytes = Buffer.from(value, 'utf8');
  let result = '';

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    if (byteIndex > 0 && separator) {
      result += separator;
    }

    const byte = bytes[byteIndex];
    if (byte === undefined) {
      continue;
    }

    for (let bit = 7; bit >= 0; bit -= 1) {
      const isSet = (byte & (1 << bit)) === 0;
      result += isSet ? ZERO_BIT : ONE_BIT;
    }
  }

  return result;
};

/**
 * Generates zero-width variants using a bitwise encoding mapping.
 */
export const encodeZeroWidthVariants = (value: string): readonly string[] => {
  if (value.length === 0) {
    return [];
  }

  return uniqueStrings([
    encodeZeroWidth(value, null),
    encodeZeroWidth(value, BYTE_SEPARATOR),
  ]);
};

/**
 * Returns encoded variants for a given encoding type.
 */
export const getEncodedVariants = (
  value: string,
  encoding: EncodingType,
): readonly string[] => {
  switch (encoding) {
    case 'base64':
      return encodeBase64Variants(value);
    case 'hex':
      return encodeHexVariants(value);
    case 'zero_width':
      return encodeZeroWidthVariants(value);
  }
};

/**
 * Checks whether content contains an encoded representation of the given value.
 */
export const containsEncodedValue = (
  content: string,
  value: string,
  encoding: EncodingType,
): boolean => getEncodedVariants(value, encoding).some((variant) => content.includes(variant));
