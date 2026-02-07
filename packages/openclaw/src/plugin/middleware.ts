// Plugin-mode adapter and middleware helpers for OpenClaw.

import type { Message, ScenarioConfig, TelemetryEvent } from '@lmda/core';
import { TelemetryCollector } from '@lmda/core';

import type { OpenClawAdapter, OpenClawProviderOptions } from '../provider.js';
import { OpenClawProviderError } from '../provider.js';

export interface OpenClawMiddleware {
  handleEvent(event: TelemetryEvent): void;
}

/**
 * Builds an OpenClaw middleware handler that records telemetry events.
 */
export const createOpenClawMiddleware = (collector: TelemetryCollector): OpenClawMiddleware => ({
  handleEvent: (event: TelemetryEvent) => {
    collector.add(event);
  },
});

/**
 * Adapter that expects telemetry events from OpenClaw hooks.
 * Plugin mode is push-based via createOpenClawMiddleware and handleEvent; execute() is not used and will throw.
 */
export class PluginGateway implements OpenClawAdapter {
  constructor(_options: OpenClawProviderOptions) {}

  public configure(_scenario: ScenarioConfig): Promise<void> {
    return Promise.resolve();
  }

  public async *execute(_messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    throw new OpenClawProviderError('plugin', 'Plugin gateway integration is not configured.');
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }
}
