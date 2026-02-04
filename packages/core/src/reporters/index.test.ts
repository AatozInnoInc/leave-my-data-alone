import { describe, expect, it } from 'vitest';

import {
  ConsoleReporter,
  JsonReporter,
  JunitReporter,
  createReportBundle,
  createReportSummary,
} from './index.js';

describe('reporters index exports', () => {
  it('should expose reporter constructors and helpers', () => {
    // Arrange
    const exports = {
      ConsoleReporter,
      JsonReporter,
      JunitReporter,
      createReportBundle,
      createReportSummary,
    };

    // Act
    const values = Object.values(exports);

    // Assert
    values.forEach((value) => {
      expect(value).toBeDefined();
    });
  });
});
