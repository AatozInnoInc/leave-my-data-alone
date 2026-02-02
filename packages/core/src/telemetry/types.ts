// Telemetry types and provider interface for LMDA core.

import type { Message, ScenarioConfig } from '../scenario/types.js';

/**
 * Telemetry event types produced during scenario execution.
 */
export type TelemetryEventType =
  | 'tool_call_start'
  | 'tool_call_end'
  | 'llm_output'
  | 'llm_output_chunk'
  | 'memory_read'
  | 'memory_write'
  | 'retrieval_inject'
  | 'user_confirmation_requested'
  | 'user_confirmation_response';

/**
 * Payload container for telemetry events.
 */
export type TelemetryPayload = Readonly<Record<string, unknown>>;

/**
 * A single telemetry event captured from the provider.
 */
export interface TelemetryEvent {
  readonly timestamp: Date;
  readonly type: TelemetryEventType;
  readonly payload: TelemetryPayload;
}

/**
 * Provider interface for collecting telemetry from a runtime.
 */
export interface TelemetryProvider {
  configure(scenario: ScenarioConfig): Promise<void>;
  execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
  teardown(): Promise<void>;
}
