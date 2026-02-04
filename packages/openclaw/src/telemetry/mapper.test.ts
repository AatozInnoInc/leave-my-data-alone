import { describe, expect, it } from 'vitest';

import { mapOpenClawTelemetryEvent } from './mapper.js';

describe('mapOpenClawTelemetryEvent', () => {
  it('should map openclaw telemetry to core events', () => {
    // Arrange
    const event = {
      timestamp: new Date(0),
      type: 'llm_output' as const,
      payload: { content: 'ok' },
    };

    // Act
    const mapped = mapOpenClawTelemetryEvent(event);

    // Assert
    expect(mapped).toEqual(event);
  });
});
