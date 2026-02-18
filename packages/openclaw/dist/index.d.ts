import { ScenarioConfig, Message, TelemetryEvent, TelemetryProvider, TelemetryCollector, ReporterFormat, TelemetryEventType, TelemetryPayload } from '@lmda/core';

type OpenClawProviderMode = 'standalone' | 'plugin';
interface OpenClawEventSink {
    handleEvent(event: TelemetryEvent): void;
}
type OpenClawPluginRunner = (options: {
    readonly messages: readonly Message[];
    readonly eventSink: OpenClawEventSink;
}) => Promise<void>;
interface OpenClawProviderOptions {
    /**
     * How to connect to OpenClaw.
     * - 'standalone': connect to an external gateway
     * - 'plugin': run as middleware inside the gateway
     */
    readonly mode: OpenClawProviderMode;
    /**
     * Gateway URL (standalone mode only).
     */
    readonly gatewayUrl?: string;
    /**
     * Gateway auth token (standalone mode only).
     */
    readonly authToken?: string;
    /**
     * Agent id to target (standalone mode only).
     */
    readonly agentId?: string;
    /**
     * Session key to reuse across agent calls (standalone mode only).
     */
    readonly sessionKey?: string;
    /**
     * Path to OpenClaw config (standalone mode only).
     * Reserved for future use: config-driven gateway discovery.
     */
    readonly configPath?: string;
    /**
     * Workspace root for scenario execution.
     */
    readonly workspaceRoot: string;
    /**
     * Plugin runner hook (plugin mode only).
     */
    readonly pluginRunner?: OpenClawPluginRunner;
}
declare class OpenClawProviderError extends Error {
    readonly mode: OpenClawProviderMode;
    constructor(mode: OpenClawProviderMode, message: string, options?: ErrorOptions);
}
interface OpenClawAdapter {
    configure(scenario: ScenarioConfig): Promise<void>;
    execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
    teardown(): Promise<void>;
}
/**
 * Telemetry provider for OpenClaw.
 */
declare class OpenClawProvider implements TelemetryProvider {
    private readonly adapter;
    constructor(options: OpenClawProviderOptions);
    configure(scenario: ScenarioConfig): Promise<void>;
    execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
    teardown(): Promise<void>;
}

interface OpenClawMiddleware extends OpenClawEventSink {
}
type OpenClawMiddlewareTarget = TelemetryCollector | OpenClawEventSink;
/**
 * Builds an OpenClaw middleware handler that records telemetry events.
 * Accepts a collector or an event sink.
 */
declare const createOpenClawMiddleware: (target: OpenClawMiddlewareTarget) => OpenClawMiddleware;
/**
 * Adapter that executes via a plugin runner and streams hook events.
 */
declare class PluginGateway implements OpenClawAdapter {
    private readonly options;
    private activeQueue;
    private isExecuting;
    constructor(options: OpenClawProviderOptions);
    configure(_scenario: ScenarioConfig): Promise<void>;
    /**
     * Executes a plugin run and streams telemetry events from the runner.
     *
     * Guarantees:
     * - Events are yielded in the order received from the event sink.
     * - Only one execution is allowed at a time per gateway instance.
     * - When the runner completes (or fails), iteration ends.
     *
     * Idempotency and thread safety:
     * - This method is not idempotent; invoking it multiple times creates distinct runs.
     * - Not thread-safe; use from a single event loop and avoid concurrent iteration.
     */
    execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
    teardown(): Promise<void>;
}

interface OpenClawSkill {
    readonly name: string;
    readonly description: string;
    execute(input: string): Promise<string>;
}
interface LmdaSkillOptions {
    readonly workspaceRoot: string;
    readonly pluginRunner: OpenClawPluginRunner;
    readonly scenarioRoot?: string;
    readonly defaultReporter?: ReporterFormat;
}
declare class OpenClawSkillError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/**
 * Creates the LMDA skill definition for OpenClaw.
 */
declare const createLmdaSkill: (options?: LmdaSkillOptions) => OpenClawSkill;

/**
 * Adapter that connects to an external OpenClaw gateway.
 */
declare class StandaloneGateway implements OpenClawAdapter {
    private readonly options;
    private client;
    constructor(options: OpenClawProviderOptions);
    configure(_scenario: ScenarioConfig): Promise<void>;
    execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent>;
    teardown(): Promise<void>;
}

interface OpenClawWebSocketClient {
    readonly url: string;
    readonly readyState: number;
    onOpen(handler: () => void): void;
    onMessage(handler: (data: string) => void): void;
    onClose(handler: (code: number, reason: string) => void): void;
    onError(handler: (error: Error) => void): void;
    send(payload: string): void;
    close(code?: number, reason?: string): void;
}
declare class OpenClawWebSocketError extends Error {
    readonly url: string;
    constructor(url: string, message: string, options?: ErrorOptions);
}
/**
 * Creates a WebSocket client for the OpenClaw gateway.
 */
declare const createWebSocketClient: (url: string) => OpenClawWebSocketClient;

/**
 * Parses a JSONL session line into a TelemetryEvent.
 */
declare const parseSessionLine: (line: string) => TelemetryEvent | null;

interface OpenClawTelemetryEvent {
    readonly timestamp: Date;
    readonly type: TelemetryEventType;
    readonly payload: TelemetryPayload;
}
/**
 * Maps an OpenClaw telemetry event into LMDA core telemetry.
 * Currently a pass-through; this seam allows transformation when OpenClaw and core types diverge.
 */
declare const mapOpenClawTelemetryEvent: (event: OpenClawTelemetryEvent) => TelemetryEvent;

export { type OpenClawAdapter, type OpenClawEventSink, type OpenClawMiddleware, type OpenClawPluginRunner, OpenClawProvider, OpenClawProviderError, type OpenClawProviderMode, type OpenClawProviderOptions, type OpenClawSkill, OpenClawSkillError, type OpenClawTelemetryEvent, type OpenClawWebSocketClient, OpenClawWebSocketError, PluginGateway, StandaloneGateway, createLmdaSkill, createOpenClawMiddleware, createWebSocketClient, mapOpenClawTelemetryEvent, parseSessionLine };
