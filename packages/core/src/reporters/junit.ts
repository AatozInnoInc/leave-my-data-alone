// JUnit reporter for LMDA.

import type { ReportBundle, Reporter, ReporterOutput, ScenarioReport } from './types.js';

const escapeXml = (value: string): string =>
  value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');

const formatDurationSeconds = (durationMs: number): string =>
  (Math.max(0, durationMs) / 1000).toFixed(3);

const getScenarioDurationMs = (report: ScenarioReport): number =>
  Math.max(0, report.finishedAt.getTime() - report.startedAt.getTime());

const buildFailureElements = (report: ScenarioReport): readonly string[] => {
  if (report.result.violations.length === 0) {
    return [];
  }

  return report.result.violations.map((violation) => {
    const message = `${violation.invariant}: ${violation.details}`;
    const body = `Event: ${violation.event.type}`;

    return `<failure message="${escapeXml(message)}">${escapeXml(body)}</failure>`;
  });
};

const buildTestcaseLines = (report: ScenarioReport): readonly string[] => {
  const name = escapeXml(report.scenario.metadata.id);
  const classname = escapeXml(report.scenario.metadata.attackClass);
  const time = formatDurationSeconds(getScenarioDurationMs(report));
  const failures = buildFailureElements(report);

  if (failures.length === 0) {
    return [`  <testcase name="${name}" classname="${classname}" time="${time}" />`];
  }

  return [
    `  <testcase name="${name}" classname="${classname}" time="${time}">`,
    ...failures.map((failure) => `    ${failure}`),
    '  </testcase>',
  ];
};

/**
 * Reporter that formats results as JUnit XML.
 */
export class JunitReporter implements Reporter {
  public readonly format = 'junit';

  public report(bundle: ReportBundle): ReporterOutput {
    const tests = bundle.summary.total;
    const failures = bundle.summary.failed;
    const time = formatDurationSeconds(bundle.summary.durationMs);
    const timestamp = bundle.generatedAt.toISOString();

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      `<testsuite name="LMDA" tests="${tests}" failures="${failures}" time="${time}" timestamp="${escapeXml(
        timestamp,
      )}">`,
    );

    if (bundle.reports.length > 0) {
      for (const report of bundle.reports) {
        lines.push(...buildTestcaseLines(report));
      }
    }

    lines.push('</testsuite>');

    return {
      format: 'junit',
      contentType: 'application/xml',
      extension: 'xml',
      content: lines.join('\n'),
    };
  }
}
