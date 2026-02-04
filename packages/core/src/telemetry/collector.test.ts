import { describe, expect, it } from 'vitest';

import type { Message, ScenarioConfig } from '../scenario/types.js';
import { TelemetryCollector, collectTelemetry } from './collector.js';
import type { TelemetryEvent, TelemetryProvider } from './types.js';

class StubProvider implements TelemetryProvider {
  private readonly events: readonly TelemetryEvent[];

  constructor(events: readonly TelemetryEvent[]) {
    this.events = events;
  }

  public configure(_scenario: ScenarioConfig): Promise<void> {
    return Promise.resolve();
  }

  public async *execute(_messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    for (const event of this.events) {
      yield event;
    }
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }
}

describe('TelemetryCollector', () => {
  it('should collect events from a provider stream', async () => {
    // Arrange
    const events: TelemetryEvent[] = [
      { timestamp: new Date(0), type: 'llm_output', payload: { content: 'ok' } },
      { timestamp: new Date(1), type: 'tool_call_start', payload: { tool: 'email.send' } },
    ];
    const provider = new StubProvider(events);

    // Act
    const collected = await collectTelemetry(provider, []);

    // Assert
    expect(collected).toEqual(events);
  });

  it('should allow manual event collection', () => {
    // Arrange
    const event: TelemetryEvent = {
      timestamp: new Date(0),
      type: 'llm_output',
      payload: { content: 'ok' },
    };
    const collector = new TelemetryCollector();

    // Act
    collector.add(event);

    // Assert
    expect(collector.list()).toEqual([event]);
  });
});
