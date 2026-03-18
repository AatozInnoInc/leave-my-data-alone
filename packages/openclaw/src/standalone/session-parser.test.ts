import { describe, expect, it } from 'vitest';

import { parseSessionLine } from './session-parser.js';

describe('parseSessionLine', () => {
  it('should parse valid telemetry events', () => {
    // Arrange
    const line = JSON.stringify({
      timestamp: '1970-01-01T00:00:00.000Z',
      type: 'llm_output',
      payload: { content: 'ok' },
    });

    // Act
    const event = parseSessionLine(line);

    // Assert
    expect(event?.type).toBe('llm_output');
    expect(event?.payload).toEqual({ content: 'ok' });
  });

  it('should return null for invalid JSON', () => {
    // Arrange
    const line = '{invalid';

    // Act
    const event = parseSessionLine(line);

    // Assert
    expect(event).toBeNull();
  });

  it('should return null for unsupported event types', () => {
    // Arrange
    const line = JSON.stringify({
      timestamp: '1970-01-01T00:00:00.000Z',
      type: 'unknown',
      payload: {},
    });

    // Act
    const event = parseSessionLine(line);

    // Assert
    expect(event).toBeNull();
  });

  it('should parse numeric timestamp (ms since epoch)', () => {
    const line = JSON.stringify({
      timestamp: 1706000000000,
      type: 'llm_output',
      payload: {},
    });
    const event = parseSessionLine(line);
    expect(event).not.toBeNull();
    if (!event) {
      throw new Error('Expected parsed event.');
    }
    expect(event.timestamp.getTime()).toBe(1706000000000);
  });

  it('should return null for empty string lines', () => {
    expect(parseSessionLine('')).toBeNull();
    expect(parseSessionLine('   ')).toBeNull();
  });

  it('should parse ISO timestamp string', () => {
    const line = JSON.stringify({
      timestamp: '1970-01-01T00:00:00.000Z',
      type: 'llm_output',
      payload: { content: 'ok' },
    });
    const event = parseSessionLine(line);
    expect(event?.timestamp.getTime()).toBe(0);
  });
});
