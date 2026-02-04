// JSON reporter for LMDA.

import type { ReportBundle, Reporter, ReporterOutput } from './types.js';

/**
 * Reporter that serializes report bundles as JSON.
 */
export class JsonReporter implements Reporter {
  public readonly format = 'json';

  public report(bundle: ReportBundle): ReporterOutput {
    const payload = {
      generatedAt: bundle.generatedAt.toISOString(),
      summary: bundle.summary,
      reports: bundle.reports.map((report) => ({
        scenario: {
          metadata: report.scenario.metadata,
          agentConfig: report.scenario.agentConfig,
          fixtures: report.scenario.fixtures,
          attack: report.scenario.attack,
          invariants: report.scenario.invariants,
        },
        result: report.result,
        startedAt: report.startedAt.toISOString(),
        finishedAt: report.finishedAt.toISOString(),
      })),
    };

    return {
      format: 'json',
      contentType: 'application/json',
      extension: 'json',
      content: JSON.stringify(payload, null, 2),
    };
  }
}
