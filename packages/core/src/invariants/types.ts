// Types for invariant evaluation results.

import type { TelemetryEvent } from '../telemetry/types.js';

/**
 * Invariant identifiers used in evaluation results.
 */
export type InvariantKey = 'must_not_contain' | 'must_not_call' | 'must_not_encode';

/**
 * A single invariant violation detected in telemetry.
 */
export interface Violation {
  readonly invariant: InvariantKey;
  readonly event: TelemetryEvent;
  readonly details: string;
}

/**
 * Evaluation outcome for a scenario run.
 */
export interface EvaluationResult {
  readonly passed: boolean;
  readonly violations: readonly Violation[];
  readonly telemetryAnalyzed: number;
}
