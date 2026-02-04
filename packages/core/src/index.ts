// Public API exports for @lmda/core.

export type {
  AgentConfig,
  CanaryFixture,
  EncodingType,
  FixturesConfig,
  Invariants,
  Message,
  MessageRole,
  MustNotCallInvariant,
  MustNotContainInvariant,
  MustNotEncodeInvariant,
  PatternMatch,
  RetrievalConfig,
  ScenarioConfig,
  ScenarioMetadata,
  Severity,
  ToolConfig,
  WorkspaceFixture,
} from './scenario/types.js';
export { loadScenario, ScenarioLoadError, ScenarioValidationError } from './scenario/loader.js';

export type { EvaluationResult, Violation } from './invariants/types.js';
export { InvariantEvaluator } from './invariants/evaluator.js';

export { ScenarioEngine, ScenarioExecutionError } from './engine/runner.js';

export type { CanaryGenerationOptions, CanaryToken } from './canary/generator.js';
export { generateCanary } from './canary/generator.js';

export type {
  FixtureProvisionerOptions,
  FixtureProvisioningResult,
  ProvisionedWorkspaceFixture,
} from './fixtures/provisioner.js';
export { FixtureProvisionError, provisionFixtures } from './fixtures/provisioner.js';

export type { TelemetryEvent, TelemetryEventType, TelemetryPayload, TelemetryProvider } from './telemetry/types.js';
export { collectTelemetry, TelemetryCollector } from './telemetry/collector.js';

export type { SourceDescriptor, SourceRegistry, SourceTier } from './sources/registry.js';
export { createSourceRegistry } from './sources/registry.js';
export type {
  SourceSyncOptions,
  SourceSyncReport,
  SourceSyncResult,
  SourceSyncSummary,
} from './sources/sync.js';
export { syncSources, UnknownSourceError } from './sources/sync.js';
export type { SourceAdapter, SourceAdapterRegistry, SourceSyncOutcome, SourceSyncStatus } from './sources/adapters/types.js';
export { createSourceAdapterRegistry } from './sources/adapters/types.js';
export { createDefaultSourceAdapterRegistry } from './sources/adapters/index.js';

export {
  ConsoleReporter,
  JsonReporter,
  JunitReporter,
  createReportBundle,
  createReportSummary,
  type ReportBundle,
  type Reporter,
  type ReporterFormat,
  type ReporterOutput,
  type ReportSummary,
  type ScenarioReport,
} from './reporters/index.js';
