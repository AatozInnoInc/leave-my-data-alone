import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Message, ScenarioConfig } from '../scenario/types.js';
import type { TelemetryEvent, TelemetryEventType, TelemetryProvider } from './types.js';

class TestTelemetryProvider implements TelemetryProvider {
  configure(_scenario: ScenarioConfig): Promise<void> {
    return Promise.resolve();
  }

  async *execute(_messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    // Keeps the test provider aligned with async generator behavior.
    await Promise.resolve();
    yield {
      timestamp: new Date(0),
      type: 'llm_output',
      payload: {
        content: 'ok',
      },
    };
  }

  teardown(): Promise<void> {
    return Promise.resolve();
  }
}

describe('Telemetry types', () => {
  it('should include all event type variants', (): void => {
    expectTypeOf<TelemetryEventType>().toEqualTypeOf<
      | 'tool_call_start'
      | 'tool_call_end'
      | 'llm_output'
      | 'llm_output_chunk'
      | 'memory_read'
      | 'memory_write'
      | 'retrieval_inject'
      | 'user_confirmation_requested'
      | 'user_confirmation_response'
    >();
  });

  it('should stream telemetry events from providers', async (): Promise<void> => {
    const provider = new TestTelemetryProvider();
    const events: TelemetryEvent[] = [];

    for await (const event of provider.execute([{ role: 'user', content: 'Hello' }])) {
      events.push(event);
    }

    const [firstEvent] = events;
    if (firstEvent) {
      expect(firstEvent.type).toBe('llm_output');
      expect(firstEvent.payload).toMatchObject({ content: 'ok' });
    } else {
      throw new Error('Expected at least one telemetry event.');
    }
  });
});
