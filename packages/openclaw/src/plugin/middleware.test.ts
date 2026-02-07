import { describe, expect, it } from 'vitest';

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

  it('should surface plugin integration errors', async () => {
    // Arrange
    const gateway = new PluginGateway({ mode: 'plugin', workspaceRoot: '/tmp/lmda' });

    // Act
    const iterator = gateway.execute([]);

    // Assert
    await expect(iterator.next()).rejects.toBeInstanceOf(OpenClawProviderError);
  });
});
