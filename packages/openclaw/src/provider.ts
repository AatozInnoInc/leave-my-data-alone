// OpenClaw telemetry provider implementation.

import type { Message, ScenarioConfig, TelemetryEvent, TelemetryProvider } from '@lmda/core';

import { PluginGateway } from './plugin/middleware.js';
import { StandaloneGateway } from './standalone/gateway.js';

export type OpenClawProviderMode = 'standalone' | 'plugin';

export interface OpenClawEventSink {
  handleEvent(event: TelemetryEvent): void;
}

export type OpenClawPluginRunner = (options: {
  readonly messages: readonly Message[];
  readonly eventSink: OpenClawEventSink;
}) => Promise<void>;

export interface OpenClawProviderOptions {
  /**
   * How to connect to OpenClaw.
   * - 'standalone': connect to an external gateway
   * - 'plugin': run as middleware inside the gateway
   */
  readonly mode: OpenClawProviderMode;
  /**
   * Gateway URL (standalone mode only).
   */
  readonly gatewayUrl?: string;
  /**
   * Gateway auth token (standalone mode only).
   */
  readonly authToken?: string;
  /**
   * Agent id to target (standalone mode only).
   */
  readonly agentId?: string;
  /**
   * Session key to reuse across agent calls (standalone mode only).
   */
  readonly sessionKey?: string;
  /**
   * Path to OpenClaw config (standalone mode only).
   * Reserved for future use: config-driven gateway discovery.
   */
  readonly configPath?: string;
  /**
   * Workspace root for scenario execution.
   */
  readonly workspaceRoot: string;
  /**
   * Plugin runner hook (plugin mode only).
   */
  readonly pluginRunner?: OpenClawPluginRunner;
}

export class OpenClawProviderError extends Error {
  public readonly mode: OpenClawProviderMode;

  constructor(mode: OpenClawProviderMode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OpenClawProviderError';
    this.mode = mode;
  }
}

export interface OpenClawAdapter {
  configure(scenario: ScenarioConfig): Promise<void>;
  execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
  teardown(): Promise<void>;
}

const validateWorkspaceRoot = (workspaceRoot: string, mode: OpenClawProviderMode): void => {
  if (workspaceRoot.trim().length > 0) {
    return;
  }

  throw new OpenClawProviderError(mode, 'Workspace root must be a non-empty path.');
};

/**
 * Telemetry provider for OpenClaw.
 */
export class OpenClawProvider implements TelemetryProvider {
  private readonly adapter: OpenClawAdapter;

  constructor(options: OpenClawProviderOptions) {
    validateWorkspaceRoot(options.workspaceRoot, options.mode);

    if (options.mode === 'standalone') {
      this.adapter = new StandaloneGateway(options);
      return;
    }

    this.adapter = new PluginGateway(options);
  }

  public configure(scenario: ScenarioConfig): Promise<void> {
    return this.adapter.configure(scenario);
  }

  public execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    return this.adapter.execute(messages);
  }

  public teardown(): Promise<void> {
    return this.adapter.teardown();
  }
}
