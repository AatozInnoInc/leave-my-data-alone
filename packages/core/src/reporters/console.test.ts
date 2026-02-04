import { describe, expect, it } from 'vitest';

import type { ScenarioReport } from './types.js';
import { createReportBundle } from './types.js';
import { ConsoleReporter } from './console.js';

const createReport = (passed: boolean): ScenarioReport => ({
  scenario: {
    metadata: {
      id: 'console-test',
      name: 'Console report scenario',
      severity: 'medium',
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
    violations: passed
      ? []
      : [
          {
            invariant: 'must_not_contain',
            event: {
              timestamp: new Date(0),
              type: 'llm_output',
              payload: { content: 'Leak' },
            },
            details: 'Pattern "Leak" found.',
          },
        ],
    telemetryAnalyzed: 1,
  },
  startedAt: new Date(0),
  finishedAt: new Date(1000),
});

describe('ConsoleReporter', () => {
  it('should format a summary and scenario results', (): void => {
    const reports = [createReport(true), createReport(false)];
    const bundle = createReportBundle(reports, new Date(2000));
    const reporter = new ConsoleReporter();

    const output = reporter.report(bundle);

    expect(output.format).toBe('console');
    expect(output.contentType).toBe('text/plain');
    expect(output.content).toContain('LMDA Report');
    expect(output.content).toContain('[PASS]');
    expect(output.content).toContain('[FAIL]');
    expect(output.content).toContain('Violations:');
  });
});
