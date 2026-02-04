// Invariant evaluation pipeline for scenario telemetry.

import type { Invariants } from '../scenario/types.js';
import type { TelemetryEvent } from '../telemetry/types.js';
import { matchMustNotCall } from './matchers/must-not-call.js';
import { matchMustNotContain } from './matchers/must-not-contain.js';
import { matchMustNotEncode } from './matchers/must-not-encode.js';
import type { EvaluationResult, Violation } from './types.js';

export interface InvariantEvaluatorOptions {
  readonly candidateValues?: readonly string[];
}

/**
 * Evaluates invariant matchers against telemetry events.
 */
export class InvariantEvaluator {
  private readonly candidateValues: readonly string[];

  constructor(options?: InvariantEvaluatorOptions) {
    this.candidateValues = options?.candidateValues ?? [];
  }

  /**
   * Evaluates invariants and returns a consolidated result.
   */
  public evaluate(
    invariants: Invariants,
    telemetry: readonly TelemetryEvent[],
  ): EvaluationResult {
    const violations: Violation[] = [];

    // Matchers are applied in a deterministic order for stable reporting.
    violations.push(...matchMustNotContain(invariants.mustNotContain, telemetry));
    violations.push(...matchMustNotCall(invariants.mustNotCall, telemetry));
    violations.push(
      ...matchMustNotEncode(invariants.mustNotEncode, telemetry, this.candidateValues),
    );

    return {
      passed: violations.length === 0,
      violations,
      telemetryAnalyzed: telemetry.length,
    };
  }
}
