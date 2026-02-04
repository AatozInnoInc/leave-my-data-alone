import { describe, expect, it } from 'vitest';

import {
  InvariantEvaluator,
  ScenarioEngine,
  createReportBundle,
  generateCanary,
  provisionFixtures,
} from './index.js';

describe('core index exports', () => {
  it('should expose core runtime APIs', () => {
    // Arrange
    const exports = {
      InvariantEvaluator,
      ScenarioEngine,
      createReportBundle,
      generateCanary,
      provisionFixtures,
    };

    // Act
    const values = Object.values(exports);

    // Assert
    values.forEach((value) => {
      expect(value).toBeDefined();
    });
  });
});
