import { describe, expect, it } from 'vitest';

import type { ScenarioReport } from './types.js';
import { createReportBundle } from './types.js';
import { JunitReporter } from './junit.js';

const createReport = (passed: boolean, violationDetails?: string): ScenarioReport => ({
  scenario: {
    metadata: {
      id: 'junit-test',
      name: 'JUnit report scenario',
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
    violations:
      passed === true
        ? []
        : [
            {
              invariant: 'must_not_call',
              event: {
                timestamp: new Date(0),
                type: 'tool_call_start',
                payload: { tool: 'email.send' },
              },
              details: violationDetails ?? 'Tool called',
            },
          ],
    telemetryAnalyzed: 1,
  },
  startedAt: new Date(0),
  finishedAt: new Date(1000),
});

describe('JunitReporter', () => {
  it('should output JUnit XML for passing tests', (): void => {
    const bundle = createReportBundle([createReport(true)], new Date(2000));
    const reporter = new JunitReporter();

    const output = reporter.report(bundle);

    expect(output.format).toBe('junit');
    expect(output.contentType).toBe('application/xml');
    expect(output.content).toContain('<testsuite');
    expect(output.content).toContain('tests="1"');
    expect(output.content).toContain('failures="0"');
    expect(output.content).toContain('<testcase');
  });

  it('should include failure details and escape XML', (): void => {
    const bundle = createReportBundle(
      [createReport(false, 'Pattern "<bad>" & data')],
      new Date(2000),
    );
    const reporter = new JunitReporter();

    const output = reporter.report(bundle);

    expect(output.content).toContain('<failure');
    expect(output.content).toContain('&lt;bad&gt;');
    expect(output.content).toContain('&amp;');
  });
});
