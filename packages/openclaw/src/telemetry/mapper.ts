// OpenClaw telemetry mapper to LMDA core events.

import type { TelemetryEvent, TelemetryEventType, TelemetryPayload } from '@lmda/core';

export interface OpenClawTelemetryEvent {
  readonly timestamp: Date;
  readonly type: TelemetryEventType;
  readonly payload: TelemetryPayload;
}

/**
 * Maps an OpenClaw telemetry event into LMDA core telemetry.
 */
export const mapOpenClawTelemetryEvent = (event: OpenClawTelemetryEvent): TelemetryEvent => ({
  timestamp: event.timestamp,
  type: event.type,
  payload: event.payload,
});
