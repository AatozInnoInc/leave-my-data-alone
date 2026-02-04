// Telemetry collector for provider event streams.

import type { Message } from '../scenario/types.js';
import type { TelemetryEvent, TelemetryProvider } from './types.js';

/**
 * Collects telemetry events from a provider execution stream.
 */
export class TelemetryCollector {
  private readonly events: TelemetryEvent[] = [];

  public add(event: TelemetryEvent): void {
    this.events.push(event);
  }

  public list(): readonly TelemetryEvent[] {
    return [...this.events];
  }

  public async collect(
    provider: TelemetryProvider,
    messages: readonly Message[],
  ): Promise<readonly TelemetryEvent[]> {
    for await (const event of provider.execute(messages)) {
      this.add(event);
    }

    return this.list();
  }
}

/**
 * Collects telemetry events using a new collector instance.
 */
export const collectTelemetry = async (
  provider: TelemetryProvider,
  messages: readonly Message[],
): Promise<readonly TelemetryEvent[]> => {
  const collector = new TelemetryCollector();
  return collector.collect(provider, messages);
};
