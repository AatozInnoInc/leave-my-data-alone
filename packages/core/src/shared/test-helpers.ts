/**
 * Test fixture factory for scenario YAML generation.
 * Provides a builder pattern for creating valid and invalid scenario configurations.
 */

export interface ScenarioYamlBuilderOptions {
  id?: string;
  name?: string;
  description?: string;
  severity?: string;
  attackClass?: string;
  tags?: string[];
  toolsEnabled?: string[];
  toolsRequireConfirmation?: string[];
  memory?: boolean;
  retrieval?: Array<{ type: string; fixture: string }>;
  canaries?: Array<{ id: string; value: string }>;
  workspace?: Array<{ source: string; target: string }>;
  attack?: Array<{ role: string; content: string }>;
  invariantsMustNotContain?: Array<{ pattern: string }>;
  invariantsMustNotCall?: Array<{ tool: string; args: Record<string, unknown> }>;
  invariantsMustNotEncode?: Array<{ type: string; of: string[] }>;
}

/**
 * Builder for creating scenario YAML test fixtures.
 * Uses fluent interface for readable, composable test data generation.
 */
export class ScenarioYamlBuilder {
  private options: Required<ScenarioYamlBuilderOptions> = {
    id: 'test-scenario',
    name: 'Test Scenario',
    description: '',
    severity: 'low',
    attackClass: 'test',
    tags: [],
    toolsEnabled: [],
    toolsRequireConfirmation: [],
    memory: false,
    retrieval: [],
    canaries: [],
    workspace: [],
    attack: [],
    invariantsMustNotContain: [],
    invariantsMustNotCall: [],
    invariantsMustNotEncode: [],
  };

  public withId(id: string): this {
    this.options.id = id;
    return this;
  }

  public withName(name: string): this {
    this.options.name = name;
    return this;
  }

  public withDescription(description: string): this {
    this.options.description = description;
    return this;
  }

  public withSeverity(severity: string): this {
    this.options.severity = severity;
    return this;
  }

  public withAttackClass(attackClass: string): this {
    this.options.attackClass = attackClass;
    return this;
  }

  public withTags(tags: string[]): this {
    this.options.tags = tags;
    return this;
  }

  public withToolsEnabled(tools: string[]): this {
    this.options.toolsEnabled = tools;
    return this;
  }

  public withToolsRequireConfirmation(tools: string[]): this {
    this.options.toolsRequireConfirmation = tools;
    return this;
  }

  public withMemory(memory: boolean): this {
    this.options.memory = memory;
    return this;
  }

  public withRetrieval(retrieval: Array<{ type: string; fixture: string }>): this {
    this.options.retrieval = retrieval;
    return this;
  }

  public withCanaries(canaries: Array<{ id: string; value: string }>): this {
    this.options.canaries = canaries;
    return this;
  }

  public withWorkspace(workspace: Array<{ source: string; target: string }>): this {
    this.options.workspace = workspace;
    return this;
  }

  public withAttack(attack: Array<{ role: string; content: string }>): this {
    this.options.attack = attack;
    return this;
  }

  public withMustNotContain(patterns: Array<{ pattern: string }>): this {
    this.options.invariantsMustNotContain = patterns;
    return this;
  }

  public withMustNotCall(calls: Array<{ tool: string; args: Record<string, unknown> }>): this {
    this.options.invariantsMustNotCall = calls;
    return this;
  }

  public withMustNotEncode(encodings: Array<{ type: string; of: string[] }>): this {
    this.options.invariantsMustNotEncode = encodings;
    return this;
  }

  /**
   * Generates the YAML string representation of the scenario.
   */
  public build(): string {
    const parts: string[] = [];

    // Metadata section
    parts.push('metadata:');
    parts.push(`  id: "${this.options.id}"`);
    parts.push(`  name: "${this.options.name}"`);

    if (this.options.description) {
      parts.push(`  description: "${this.options.description}"`);
    }

    parts.push(`  severity: ${this.options.severity}`);
    parts.push(`  attack_class: ${this.options.attackClass}`);

    if (this.options.tags.length > 0) {
      parts.push('  tags:');
      this.options.tags.forEach((tag) => {
        parts.push(`    - ${tag}`);
      });
    }

    // Agent config section
    parts.push('agent_config:');
    parts.push('  tools:');

    if (this.options.toolsEnabled.length > 0) {
      parts.push('    enabled:');
      this.options.toolsEnabled.forEach((tool) => {
        parts.push(`      - ${tool}`);
      });
    } else {
      parts.push('    enabled: []');
    }

    if (this.options.toolsRequireConfirmation.length > 0) {
      parts.push('    require_confirmation:');
      this.options.toolsRequireConfirmation.forEach((tool) => {
        parts.push(`      - ${tool}`);
      });
    }

    parts.push(`  memory: ${this.options.memory}`);

    if (this.options.retrieval.length > 0) {
      parts.push('  retrieval:');
      this.options.retrieval.forEach((r) => {
        parts.push(`    - type: ${r.type}`);
        parts.push(`      fixture: ${r.fixture}`);
      });
    }

    // Fixtures section
    if (this.options.canaries.length > 0 || this.options.workspace.length > 0) {
      parts.push('fixtures:');

      if (this.options.canaries.length > 0) {
        parts.push('  canaries:');
        this.options.canaries.forEach((canary) => {
          parts.push(`    - id: ${canary.id}`);
          parts.push(`      value: ${canary.value}`);
        });
      }

      if (this.options.workspace.length > 0) {
        parts.push('  workspace:');
        this.options.workspace.forEach((ws) => {
          parts.push(`    - source: ${ws.source}`);
          parts.push(`      target: ${ws.target}`);
        });
      }
    }

    // Attack section
    if (this.options.attack.length > 0) {
      parts.push('attack:');
      this.options.attack.forEach((step) => {
        parts.push(`  - role: ${step.role}`);
        parts.push(`    content: "${step.content}"`);
      });
    } else {
      parts.push('attack: []');
    }

    // Invariants section
    const hasInvariants =
      this.options.invariantsMustNotContain.length > 0 ||
      this.options.invariantsMustNotCall.length > 0 ||
      this.options.invariantsMustNotEncode.length > 0;

    if (hasInvariants) {
      parts.push('invariants:');

      if (this.options.invariantsMustNotContain.length > 0) {
        parts.push('  must_not_contain:');
        this.options.invariantsMustNotContain.forEach((inv) => {
          parts.push(`    - pattern: ${inv.pattern}`);
        });
      }

      if (this.options.invariantsMustNotCall.length > 0) {
        parts.push('  must_not_call:');
        this.options.invariantsMustNotCall.forEach((inv) => {
          parts.push(`    - tool: ${inv.tool}`);
          parts.push('      args:');
          Object.entries(inv.args).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              parts.push(`        ${key}:`);
              Object.entries(value).forEach(([k, v]) => {
                parts.push(`          ${k}: "${v}"`);
              });
            } else {
              parts.push(`        ${key}: ${value}`);
            }
          });
        });
      }

      if (this.options.invariantsMustNotEncode.length > 0) {
        parts.push('  must_not_encode:');
        this.options.invariantsMustNotEncode.forEach((inv) => {
          parts.push(`    - type: ${inv.type}`);
          parts.push('      of:');
          inv.of.forEach((val) => {
            parts.push(`        - ${val}`);
          });
        });
      }
    } else {
      parts.push('invariants: {}');
    }

    return parts.join('\n');
  }
}

/**
 * Creates a new scenario YAML builder with default values.
 */
export function createScenarioYaml(): ScenarioYamlBuilder {
  return new ScenarioYamlBuilder();
}

/**
 * Invalid YAML fixtures for negative testing.
 */
export const InvalidYamlFixtures = {
  /**
   * YAML with invalid severity value (schema validation failure).
   */
  invalidSeverity: (): string => `
metadata:
  id: "invalid"
  name: "Invalid scenario"
  severity: unknown
  attack_class: test
agent_config:
  tools:
    enabled:
      - email.read
  memory: true
attack:
  - role: user
    content: "Hello"
invariants: {}
`,

  /**
   * Malformed YAML syntax (parse failure).
   */
  malformedSyntax: (): string => `
metadata:
  id: "invalid
  name: "Invalid YAML"
  severity: high
  attack_class: test
agent_config:
  tools:
    enabled:
      - email.read
  memory: true
attack:
  - role: user
    content: "Hello"
invariants: {}
`,

  /**
   * Generic invalid YAML for parser testing.
   */
  unclosedArray: (): string => 'invalid: [',
};
