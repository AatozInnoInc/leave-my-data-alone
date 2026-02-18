/**
 * Severity level for a scenario.
 */
type Severity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Scenario metadata used for identification and reporting.
 */
interface ScenarioMetadata {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly severity: Severity;
    readonly attackClass: string;
    readonly tags?: readonly string[];
}
/**
 * Tool settings for the agent under test.
 */
interface ToolConfig {
    readonly enabled: readonly string[];
    readonly requireConfirmation?: readonly string[];
}
/**
 * Retrieval configuration for scenario setup.
 */
interface RetrievalConfig {
    readonly type: string;
    readonly fixture: string;
}
/**
 * Agent behavior configuration.
 */
interface AgentConfig {
    readonly tools: ToolConfig;
    readonly memory: boolean;
    readonly retrieval?: readonly RetrievalConfig[];
}
/**
 * Canary tokens injected into fixtures.
 */
interface CanaryFixture {
    readonly id: string;
    readonly value: string;
}
/**
 * Workspace fixture to copy into the scenario sandbox.
 */
interface WorkspaceFixture {
    readonly source: string;
    readonly target: string;
}
/**
 * Fixtures bundled with a scenario.
 */
interface FixturesConfig {
    readonly canaries?: readonly CanaryFixture[];
    readonly workspace?: readonly WorkspaceFixture[];
}
/**
 * Message role used for scenario attack steps.
 */
type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
/**
 * A single message in the attack sequence.
 */
interface Message {
    readonly role: MessageRole;
    readonly content: string;
}
/**
 * Pattern-based match used for argument checks.
 */
interface PatternMatch {
    readonly pattern: string;
}
type ArgumentMatch = string | number | boolean | null | PatternMatch | ArgumentMatchObject | readonly ArgumentMatch[];
/**
 * Nested argument matcher map for tool call invariants.
 */
interface ArgumentMatchObject {
    readonly [key: string]: ArgumentMatch;
}
/**
 * Invariant: response must not contain matching patterns.
 */
interface MustNotContainInvariant {
    readonly pattern: string;
}
/**
 * Invariant: tool calls must not occur, optionally matching arguments.
 */
interface MustNotCallInvariant {
    readonly tool: string;
    readonly args?: ArgumentMatchObject;
}
/**
 * Encoding types supported for exfiltration checks.
 */
type EncodingType = 'base64' | 'hex' | 'zero_width';
/**
 * Invariant: sensitive values must not appear in encoded form.
 */
interface MustNotEncodeInvariant {
    readonly type: EncodingType;
    readonly of?: readonly string[];
}
/**
 * Invariants enforced during evaluation.
 */
interface Invariants {
    readonly mustNotContain?: readonly MustNotContainInvariant[];
    readonly mustNotCall?: readonly MustNotCallInvariant[];
    readonly mustNotEncode?: readonly MustNotEncodeInvariant[];
}
/**
 * Complete scenario configuration loaded from YAML.
 */
interface ScenarioConfig {
    readonly metadata: ScenarioMetadata;
    readonly agentConfig: AgentConfig;
    readonly fixtures?: FixturesConfig;
    readonly attack: readonly Message[];
    readonly invariants: Invariants;
}

/**
 * Thrown when a scenario fails schema validation.
 */
declare class ScenarioValidationError extends Error {
    readonly scenarioPath: string;
    readonly validationErrors: readonly string[];
    constructor(scenarioPath: string, validationErrors: readonly string[]);
}
/**
 * Thrown when a scenario cannot be loaded or parsed.
 */
declare class ScenarioLoadError extends Error {
    readonly scenarioPath: string;
    constructor(scenarioPath: string, message: string, options?: ErrorOptions);
}
/**
 * Loads and validates a scenario from a YAML file.
 */
declare const loadScenario: (scenarioPath: string) => Promise<ScenarioConfig>;

/**
 * Telemetry event types produced during scenario execution.
 */
type TelemetryEventType = 'tool_call_start' | 'tool_call_end' | 'llm_output' | 'llm_output_chunk' | 'memory_read' | 'memory_write' | 'retrieval_inject' | 'user_confirmation_requested' | 'user_confirmation_response';
/**
 * Payload container for telemetry events.
 */
type TelemetryPayload = Readonly<Record<string, unknown>>;
/**
 * A single telemetry event captured from the provider.
 */
interface TelemetryEvent {
    readonly timestamp: Date;
    readonly type: TelemetryEventType;
    readonly payload: TelemetryPayload;
}
/**
 * Provider interface for collecting telemetry from a runtime.
 */
interface TelemetryProvider {
    configure(scenario: ScenarioConfig): Promise<void>;
    execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
    teardown(): Promise<void>;
}

/**
 * Invariant identifiers used in evaluation results.
 */
type InvariantKey = 'must_not_contain' | 'must_not_call' | 'must_not_encode';
/**
 * A single invariant violation detected in telemetry.
 */
interface Violation {
    readonly invariant: InvariantKey;
    readonly event: TelemetryEvent;
    readonly details: string;
}
/**
 * Evaluation outcome for a scenario run.
 */
interface EvaluationResult {
    readonly passed: boolean;
    readonly violations: readonly Violation[];
    readonly telemetryAnalyzed: number;
}

interface InvariantEvaluatorOptions {
    readonly candidateValues?: readonly string[];
}
/**
 * Evaluates invariant matchers against telemetry events.
 */
declare class InvariantEvaluator {
    private readonly candidateValues;
    constructor(options?: InvariantEvaluatorOptions);
    /**
     * Evaluates invariants and returns a consolidated result.
     */
    evaluate(invariants: Invariants, telemetry: readonly TelemetryEvent[]): EvaluationResult;
}

type ScenarioExecutionStage = 'configure' | 'execute' | 'teardown';
/**
 * Error raised when scenario execution fails at a specific stage.
 */
declare class ScenarioExecutionError extends Error {
    readonly stage: ScenarioExecutionStage;
    readonly scenarioId: string;
    constructor(stage: ScenarioExecutionStage, scenarioId: string, message: string, options?: ErrorOptions);
}
interface ScenarioEngineOptions {
    readonly provider: TelemetryProvider;
    readonly evaluator?: InvariantEvaluator;
}
/**
 * Runs scenarios by coordinating provider execution and invariant evaluation.
 */
declare class ScenarioEngine {
    private readonly provider;
    private readonly evaluatorOverride?;
    constructor(options: ScenarioEngineOptions);
    run(scenario: ScenarioConfig): Promise<EvaluationResult>;
    private configureScenario;
    private collectTelemetry;
    private teardownScenario;
    private wrapError;
}

interface CanaryToken {
    readonly id: string;
    readonly value: string;
}
interface CanaryGenerationOptions {
    readonly id: string;
    readonly prefix?: string;
    readonly entropyBytes?: number;
}
/**
 * Generates a canary token with a randomized suffix.
 */
declare const generateCanary: (options: CanaryGenerationOptions) => CanaryToken;

interface FixtureProvisionerOptions {
    readonly scenarioRoot: string;
    readonly workspaceRoot: string;
    readonly fixtures?: FixturesConfig;
}
interface ProvisionedWorkspaceFixture {
    readonly source: string;
    readonly target: string;
}
interface FixtureProvisioningResult {
    readonly canaries: readonly CanaryFixture[];
    readonly workspace: readonly ProvisionedWorkspaceFixture[];
}
declare class FixtureProvisionError extends Error {
    readonly source: string;
    readonly target: string;
    constructor(source: string, target: string, message: string, options?: ErrorOptions);
}
/**
 * Provisions scenario fixtures into a workspace root.
 */
declare const provisionFixtures: (options: FixtureProvisionerOptions) => Promise<FixtureProvisioningResult>;

/**
 * Collects telemetry events from a provider execution stream.
 */
declare class TelemetryCollector {
    private readonly events;
    add(event: TelemetryEvent): void;
    list(): readonly TelemetryEvent[];
    collect(provider: TelemetryProvider, messages: readonly Message[]): Promise<readonly TelemetryEvent[]>;
}
/**
 * Collects telemetry events using a new collector instance.
 */
declare const collectTelemetry: (provider: TelemetryProvider, messages: readonly Message[]) => Promise<readonly TelemetryEvent[]>;

type SourceTier = 'tier1' | 'tier2' | 'tier3';
interface SourceDescriptor {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly homepage: string;
    readonly tier: SourceTier;
    readonly license?: string;
}
interface SourceRegistry {
    list(): readonly SourceDescriptor[];
    getById(id: string): SourceDescriptor | undefined;
}
/**
 * Creates a source registry with default Tier 1 sources.
 */
declare const createSourceRegistry: (sources?: readonly SourceDescriptor[]) => SourceRegistry;

type SourceSyncStatus = 'success' | 'failure';
interface SourceSyncOutcome {
    readonly status: SourceSyncStatus;
    readonly message?: string;
}
interface SourceSyncTarget {
    readonly source: SourceDescriptor;
    readonly outputDir: string;
}
interface SourceAdapter {
    readonly id: string;
    sync(target: SourceSyncTarget): Promise<SourceSyncOutcome>;
}
interface SourceAdapterRegistry {
    list(): readonly SourceAdapter[];
    getById(id: string): SourceAdapter | undefined;
}
/**
 * Creates a registry for source adapters.
 */
declare const createSourceAdapterRegistry: (adapters?: readonly SourceAdapter[]) => SourceAdapterRegistry;

interface SourceSyncReport {
    readonly source: SourceDescriptor;
    readonly status: 'success' | 'failure';
    readonly message?: string;
    readonly outputDir: string;
    readonly startedAt: Date;
    readonly finishedAt: Date;
}
interface SourceSyncSummary {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly durationMs: number;
}
interface SourceSyncResult {
    readonly reports: readonly SourceSyncReport[];
    readonly summary: SourceSyncSummary;
    readonly startedAt: Date;
    readonly finishedAt: Date;
}
interface SourceSyncOptions {
    readonly rootDir: string;
    readonly sourceIds?: readonly string[];
    readonly registry?: SourceRegistry;
    readonly adapters?: SourceAdapterRegistry;
}
declare class UnknownSourceError extends Error {
    readonly sourceIds: readonly string[];
    constructor(sourceIds: readonly string[]);
}
/**
 * Syncs all configured sources using adapter implementations.
 */
declare const syncSources: (options: SourceSyncOptions) => Promise<SourceSyncResult>;

interface FetchResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly statusText: string;
    arrayBuffer(): Promise<ArrayBuffer>;
}
type Fetcher = (url: string, init?: {
    readonly headers?: Record<string, string>;
}) => Promise<FetchResponse>;

interface DefaultAdapterOptions {
    readonly fetcher?: Fetcher;
}
declare const createDefaultSourceAdapterRegistry: (options?: DefaultAdapterOptions) => SourceAdapterRegistry;

/**
 * Supported report formats.
 */
type ReporterFormat = 'console' | 'json' | 'junit';
/**
 * Report output payload.
 */
interface ReporterOutput {
    readonly format: ReporterFormat;
    readonly contentType: string;
    readonly extension: string;
    readonly content: string;
}
/**
 * A single scenario run report.
 */
interface ScenarioReport {
    readonly scenario: ScenarioConfig;
    readonly result: EvaluationResult;
    readonly startedAt: Date;
    readonly finishedAt: Date;
}
/**
 * Aggregated report summary across scenarios.
 */
interface ReportSummary {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly durationMs: number;
}
/**
 * Aggregated report bundle.
 */
interface ReportBundle {
    readonly reports: readonly ScenarioReport[];
    readonly summary: ReportSummary;
    readonly generatedAt: Date;
}
/**
 * Reporter interface implemented by all output formats.
 */
interface Reporter {
    readonly format: ReporterFormat;
    report(bundle: ReportBundle): ReporterOutput;
}
/**
 * Creates a summary for the provided scenario reports.
 */
declare const createReportSummary: (reports: readonly ScenarioReport[]) => ReportSummary;
/**
 * Creates a report bundle with a generated summary.
 */
declare const createReportBundle: (reports: readonly ScenarioReport[], generatedAt?: Date) => ReportBundle;

/**
 * Reporter that formats results for console output.
 */
declare class ConsoleReporter implements Reporter {
    readonly format = "console";
    report(bundle: ReportBundle): ReporterOutput;
}

/**
 * Reporter that serializes report bundles as JSON.
 */
declare class JsonReporter implements Reporter {
    readonly format = "json";
    report(bundle: ReportBundle): ReporterOutput;
}

/**
 * Reporter that formats results as JUnit XML.
 */
declare class JunitReporter implements Reporter {
    readonly format = "junit";
    report(bundle: ReportBundle): ReporterOutput;
}

export { type AgentConfig, type CanaryFixture, type CanaryGenerationOptions, type CanaryToken, ConsoleReporter, type EncodingType, type EvaluationResult, FixtureProvisionError, type FixtureProvisionerOptions, type FixtureProvisioningResult, type FixturesConfig, InvariantEvaluator, type Invariants, JsonReporter, JunitReporter, type Message, type MessageRole, type MustNotCallInvariant, type MustNotContainInvariant, type MustNotEncodeInvariant, type PatternMatch, type ProvisionedWorkspaceFixture, type ReportBundle, type ReportSummary, type Reporter, type ReporterFormat, type ReporterOutput, type RetrievalConfig, type ScenarioConfig, ScenarioEngine, ScenarioExecutionError, ScenarioLoadError, type ScenarioMetadata, type ScenarioReport, ScenarioValidationError, type Severity, type SourceAdapter, type SourceAdapterRegistry, type SourceDescriptor, type SourceRegistry, type SourceSyncOptions, type SourceSyncOutcome, type SourceSyncReport, type SourceSyncResult, type SourceSyncStatus, type SourceSyncSummary, type SourceTier, TelemetryCollector, type TelemetryEvent, type TelemetryEventType, type TelemetryPayload, type TelemetryProvider, type ToolConfig, UnknownSourceError, type Violation, type WorkspaceFixture, collectTelemetry, createDefaultSourceAdapterRegistry, createReportBundle, createReportSummary, createSourceAdapterRegistry, createSourceRegistry, generateCanary, loadScenario, provisionFixtures, syncSources };
