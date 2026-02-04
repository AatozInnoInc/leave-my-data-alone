// Reporter types and helpers.

import type { ScenarioConfig } from '../scenario/types.js';
import type { EvaluationResult } from '../invariants/types.js';

/**
 * Supported report formats.
 */
export type ReporterFormat = 'console' | 'json' | 'junit';

/**
 * Report output payload.
 */
export interface ReporterOutput {
  readonly format: ReporterFormat;
  readonly contentType: string;
  readonly extension: string;
  readonly content: string;
}

/**
 * A single scenario run report.
 */
export interface ScenarioReport {
  readonly scenario: ScenarioConfig;
  readonly result: EvaluationResult;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

/**
 * Aggregated report summary across scenarios.
 */
export interface ReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly durationMs: number;
}

/**
 * Aggregated report bundle.
 */
export interface ReportBundle {
  readonly reports: readonly ScenarioReport[];
  readonly summary: ReportSummary;
  readonly generatedAt: Date;
}

/**
 * Reporter interface implemented by all output formats.
 */
export interface Reporter {
  readonly format: ReporterFormat;
  report(bundle: ReportBundle): ReporterOutput;
}

/**
 * Creates a summary for the provided scenario reports.
 */
export const createReportSummary = (reports: readonly ScenarioReport[]): ReportSummary => {
  const total = reports.length;
  let passed = 0;
  let durationMs = 0;

  for (const report of reports) {
    if (report.result.passed) {
      passed += 1;
    }

    const duration = report.finishedAt.getTime() - report.startedAt.getTime();
    durationMs += Math.max(0, duration);
  }

  return {
    total,
    passed,
    failed: total - passed,
    durationMs,
  };
};

/**
 * Creates a report bundle with a generated summary.
 */
export const createReportBundle = (
  reports: readonly ScenarioReport[],
  generatedAt: Date = new Date(),
): ReportBundle => ({
  reports,
  summary: createReportSummary(reports),
  generatedAt,
});
