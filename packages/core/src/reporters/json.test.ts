import { describe, expect, it } from 'vitest';

import type { ScenarioReport } from './types.js';
import { createReportBundle } from './types.js';
import { JsonReporter } from './json.js';

const createReport = (): ScenarioReport => ({
  scenario: {
    metadata: {
      id: 'json-test',
      name: 'JSON report scenario',
      severity: 'high',
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
    passed: true,
    violations: [],
    telemetryAnalyzed: 0,
  },
  startedAt: new Date(0),
  finishedAt: new Date(1000),
});

describe('JsonReporter', () => {
  it('should output JSON with metadata and summary', (): void => {
    const bundle = createReportBundle([createReport()], new Date(2000));
    const reporter = new JsonReporter();

    const output = reporter.report(bundle);
    const parsed = JSON.parse(output.content) as {
      summary: { total: number };
      generatedAt: string;
    };

    expect(output.format).toBe('json');
    expect(output.contentType).toBe('application/json');
    expect(parsed.summary.total).toBe(1);
    expect(parsed.generatedAt).toBe('1970-01-01T00:00:02.000Z');
  });
});
