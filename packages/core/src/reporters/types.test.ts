import { describe, expect, it } from 'vitest';

import type { ScenarioReport } from './types.js';
import { createReportBundle, createReportSummary } from './types.js';

const createReport = (passed: boolean, durationMs: number): ScenarioReport => ({
  scenario: {
    metadata: {
      id: 'report-test',
      name: 'Reporter test scenario',
      severity: 'low',
      attackClass: 'reporter',
    },
    agentConfig: {
      tools: { enabled: [] },
      memory: false,
    },
    attack: [],
    invariants: {},
  },
  result: {
    passed,
    violations: [],
    telemetryAnalyzed: 0,
  },
  startedAt: new Date(0),
  finishedAt: new Date(durationMs),
});

describe('reporter types helpers', () => {
  it('should summarize report outcomes', (): void => {
    const reports: ScenarioReport[] = [
      createReport(true, 1000),
      createReport(false, 500),
    ];

    const summary = createReportSummary(reports);

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.durationMs).toBe(1500);
  });

  it('should build a report bundle', (): void => {
    const reports = [createReport(true, 250)];
    const generatedAt = new Date(500);

    const bundle = createReportBundle(reports, generatedAt);

    expect(bundle.reports).toHaveLength(1);
    expect(bundle.generatedAt).toBe(generatedAt);
    expect(bundle.summary.total).toBe(1);
  });
});
