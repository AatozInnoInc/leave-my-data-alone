import { describe, expect, it, vi } from 'vitest';

import type { TelemetryEvent } from '@lmda/core';
import { TelemetryCollector } from '@lmda/core';

import { OpenClawProviderError } from '../provider.js';
import { createOpenClawMiddleware, PluginGateway } from './middleware.js';

describe('OpenClaw middleware', () => {
  it('should collect telemetry events from middleware handlers', () => {
    // Arrange
    const collector = new TelemetryCollector();
    const middleware = createOpenClawMiddleware(collector);
    const event: TelemetryEvent = {
      timestamp: new Date(0),
      type: 'llm_output',
      payload: { content: 'ok' },
    };

    // Act
    middleware.handleEvent(event);

    // Assert
    expect(collector.list()).toEqual([event]);
  });

  it('should forward telemetry events to event sinks', () => {
    // Arrange
    const handleEvent = vi.fn();
    const middleware = createOpenClawMiddleware({ handleEvent });
    const event: TelemetryEvent = {
      timestamp: new Date(0),
      type: 'llm_output_chunk',
      payload: { content: 'chunk' },
    };

    // Act
    middleware.handleEvent(event);

    // Assert
    expect(handleEvent).toHaveBeenCalledWith(event);
  });

  it('should surface plugin integration errors', async () => {
    // Arrange
    const gateway = new PluginGateway({ mode: 'plugin', workspaceRoot: '/tmp/lmda' });

    // Act
    const iterator = gateway.execute([]);

    // Assert
    await expect(iterator.next()).rejects.toBeInstanceOf(OpenClawProviderError);
  });

  it('should stream telemetry events from plugin runners', async () => {
    // Arrange
    const eventOne: TelemetryEvent = {
      timestamp: new Date(0),
      type: 'llm_output_chunk',
      payload: { content: 'one' },
    };
    const eventTwo: TelemetryEvent = {
      timestamp: new Date(1),
      type: 'llm_output',
      payload: { content: 'two' },
    };
    const gateway = new PluginGateway({
      mode: 'plugin',
      workspaceRoot: '/tmp/lmda',
      pluginRunner: async ({ eventSink }): Promise<void> => {
        eventSink.handleEvent(eventOne);
        await Promise.resolve();
        eventSink.handleEvent(eventTwo);
      },
    });

    const collect = async (): Promise<readonly TelemetryEvent[]> => {
      const events: TelemetryEvent[] = [];
      for await (const event of gateway.execute([{ role: 'user', content: 'hi' }])) {
        events.push(event);
      }
      return events;
    };

    // Act
    const events = await collect();

    // Assert
    expect(events).toEqual([eventOne, eventTwo]);
  });
});
