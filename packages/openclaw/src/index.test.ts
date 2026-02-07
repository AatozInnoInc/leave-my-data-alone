import { describe, expect, it } from 'vitest';

import {
  OpenClawProvider,
  createLmdaSkill,
  createOpenClawMiddleware,
  createWebSocketClient,
  mapOpenClawTelemetryEvent,
  parseSessionLine,
} from './index.js';

describe('openclaw index exports', () => {
  it('should expose the primary OpenClaw APIs', () => {
    // Arrange
    const exports = {
      OpenClawProvider,
      createLmdaSkill,
      createOpenClawMiddleware,
      createWebSocketClient,
      mapOpenClawTelemetryEvent,
      parseSessionLine,
    };

    // Act
    const values = Object.values(exports);

    // Assert
    values.forEach((value) => {
      expect(value).toBeDefined();
    });
  });
});
