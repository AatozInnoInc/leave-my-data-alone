// Scenario definition types for LMDA core.

/**
 * Severity level for a scenario.
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Scenario metadata used for identification and reporting.
 */
export interface ScenarioMetadata {
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
export interface ToolConfig {
  readonly enabled: readonly string[];
  readonly requireConfirmation?: readonly string[];
}

/**
 * Retrieval configuration for scenario setup.
 */
export interface RetrievalConfig {
  readonly type: string;
  readonly fixture: string;
}

/**
 * Agent behavior configuration.
 */
export interface AgentConfig {
  readonly tools: ToolConfig;
  readonly memory: boolean;
  readonly retrieval?: readonly RetrievalConfig[];
}

/**
 * Canary tokens injected into fixtures.
 */
export interface CanaryFixture {
  readonly id: string;
  readonly value: string;
}

/**
 * Workspace fixture to copy into the scenario sandbox.
 */
export interface WorkspaceFixture {
  readonly source: string;
  readonly target: string;
}

/**
 * Fixtures bundled with a scenario.
 */
export interface FixturesConfig {
  readonly canaries?: readonly CanaryFixture[];
  readonly workspace?: readonly WorkspaceFixture[];
}

/**
 * Message role used for scenario attack steps.
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * A single message in the attack sequence.
 */
export interface Message {
  readonly role: MessageRole;
  readonly content: string;
}

/**
 * Pattern-based match used for argument checks.
 */
export interface PatternMatch {
  readonly pattern: string;
}

export type ArgumentMatch =
  | string
  | number
  | boolean
  | null
  | PatternMatch
  | ArgumentMatchObject
  | readonly ArgumentMatch[];

/**
 * Nested argument matcher map for tool call invariants.
 */
export interface ArgumentMatchObject {
  readonly [key: string]: ArgumentMatch;
}

/**
 * Invariant: response must not contain matching patterns.
 */
export interface MustNotContainInvariant {
  readonly pattern: string;
}

/**
 * Invariant: tool calls must not occur, optionally matching arguments.
 */
export interface MustNotCallInvariant {
  readonly tool: string;
  readonly args?: ArgumentMatchObject;
}

/**
 * Encoding types supported for exfiltration checks.
 */
export type EncodingType = 'base64' | 'hex' | 'zero_width';

/**
 * Invariant: sensitive values must not appear in encoded form.
 */
export interface MustNotEncodeInvariant {
  readonly type: EncodingType;
  readonly of?: readonly string[];
}

/**
 * Invariants enforced during evaluation.
 */
export interface Invariants {
  readonly mustNotContain?: readonly MustNotContainInvariant[];
  readonly mustNotCall?: readonly MustNotCallInvariant[];
  readonly mustNotEncode?: readonly MustNotEncodeInvariant[];
}

/**
 * Complete scenario configuration loaded from YAML.
 */
export interface ScenarioConfig {
  readonly metadata: ScenarioMetadata;
  readonly agentConfig: AgentConfig;
  readonly fixtures?: FixturesConfig;
  readonly attack: readonly Message[];
  readonly invariants: Invariants;
}
