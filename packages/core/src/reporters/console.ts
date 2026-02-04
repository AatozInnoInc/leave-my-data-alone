// Console reporter for LMDA.

import type { ReportBundle, Reporter, ReporterOutput, ScenarioReport } from './types.js';

const formatDuration = (durationMs: number): string => `${String(durationMs)}ms`;

const formatScenarioHeader = (report: ScenarioReport): string => {
  const status = report.result.passed ? 'PASS' : 'FAIL';
  const duration = report.finishedAt.getTime() - report.startedAt.getTime();

  return `[${status}] ${report.scenario.metadata.id} (${formatDuration(Math.max(0, duration))})`;
};

const formatScenarioLines = (report: ScenarioReport): readonly string[] => {
  const lines: string[] = [];
  lines.push(formatScenarioHeader(report));
  lines.push(`  Name: ${report.scenario.metadata.name}`);
  lines.push(`  Severity: ${report.scenario.metadata.severity}`);

  if (report.result.violations.length > 0) {
    lines.push('  Violations:');

    for (const violation of report.result.violations) {
      lines.push(
        `    - ${violation.invariant}: ${violation.details} (event: ${violation.event.type})`,
      );
    }
  } else {
    lines.push('  Violations: none');
  }

  return lines;
};

/**
 * Reporter that formats results for console output.
 */
export class ConsoleReporter implements Reporter {
  public readonly format = 'console';

  public report(bundle: ReportBundle): ReporterOutput {
    const lines: string[] = [];
    lines.push('LMDA Report');
    lines.push(`Generated: ${bundle.generatedAt.toISOString()}`);
    lines.push(
      `Summary: ${String(bundle.summary.total)} total,
        ${String(bundle.summary.passed)} passed,
        ${String(bundle.summary.failed)} failed,
        ${formatDuration(bundle.summary.durationMs)}`,
    );

    if (bundle.reports.length > 0) {
      lines.push('');
    }

    for (const report of bundle.reports) {
      lines.push(...formatScenarioLines(report));
      lines.push('');
    }

    return {
      format: 'console',
      contentType: 'text/plain',
      extension: 'txt',
      content: lines.join('\n').trimEnd(),
    };
  }
}
