// YAML loader and validator for scenarios.

import { readFile } from 'node:fs/promises';

import { Value } from '@sinclair/typebox/value';
import { parse } from 'yaml';

import { scenarioSchema } from './schema.js';
import type {
  AgentConfig,
  FixturesConfig,
  Invariants,
  ScenarioConfig,
  ScenarioMetadata,
  ToolConfig,
} from './types.js';
import type { ScenarioInput } from './schema.js';

/**
 * Thrown when a scenario fails schema validation.
 */
export class ScenarioValidationError extends Error {
  public readonly scenarioPath: string;
  public readonly validationErrors: readonly string[];

  constructor(scenarioPath: string, validationErrors: readonly string[]) {
    super(`Invalid scenario at ${scenarioPath}: ${validationErrors.join(', ')}`);
    this.name = 'ScenarioValidationError';
    this.scenarioPath = scenarioPath;
    this.validationErrors = validationErrors;
  }
}

/**
 * Thrown when a scenario cannot be loaded or parsed.
 */
export class ScenarioLoadError extends Error {
  public readonly scenarioPath: string;

  constructor(scenarioPath: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScenarioLoadError';
    this.scenarioPath = scenarioPath;
  }
}

const mapMetadata = (metadata: ScenarioInput['metadata']): ScenarioMetadata => ({
  id: metadata.id,
  name: metadata.name,
  ...(metadata.description ? { description: metadata.description } : {}),
  severity: metadata.severity,
  attackClass: metadata.attack_class,
  ...(metadata.tags ? { tags: metadata.tags } : {}),
});

const mapToolConfig = (tools: ScenarioInput['agent_config']['tools']): ToolConfig => ({
  enabled: tools.enabled,
  ...(tools.require_confirmation ? { requireConfirmation: tools.require_confirmation } : {}),
});

const mapAgentConfig = (agentConfig: ScenarioInput['agent_config']): AgentConfig => ({
  tools: mapToolConfig(agentConfig.tools),
  memory: agentConfig.memory,
  ...(agentConfig.retrieval ? { retrieval: agentConfig.retrieval } : {}),
});

const mapFixtures = (
  fixtures: ScenarioInput['fixtures'] | undefined,
): FixturesConfig | undefined => {
  if (fixtures) {
    const mappedFixtures: FixturesConfig = {
      ...(fixtures.canaries ? { canaries: fixtures.canaries } : {}),
      ...(fixtures.workspace ? { workspace: fixtures.workspace } : {}),
    };

    return mappedFixtures;
  }

  return undefined;
};

const mapInvariants = (invariants: ScenarioInput['invariants']): Invariants => ({
  ...(invariants.must_not_contain ? { mustNotContain: invariants.must_not_contain } : {}),
  ...(invariants.must_not_call ? { mustNotCall: invariants.must_not_call } : {}),
  ...(invariants.must_not_encode ? { mustNotEncode: invariants.must_not_encode } : {}),
});

const mapScenarioInput = (input: ScenarioInput): ScenarioConfig => {
  const baseConfig = {
    metadata: mapMetadata(input.metadata),
    agentConfig: mapAgentConfig(input.agent_config),
    attack: input.attack,
    invariants: mapInvariants(input.invariants),
  };

  if (input.fixtures) {
    const mappedFixtures = mapFixtures(input.fixtures);
    if (mappedFixtures) {
      return {
        ...baseConfig,
        fixtures: mappedFixtures,
      };
    }
  }

  return baseConfig;
};

const getSchemaErrors = (input: unknown): readonly string[] =>
  [...Value.Errors(scenarioSchema, input)].map(
    (error) => `${error.path || 'scenario'}: ${error.message}`,
  );

/**
 * Loads and validates a scenario from a YAML file.
 */
export const loadScenario = async (scenarioPath: string): Promise<ScenarioConfig> => {
  let rawYaml: string;
  try {
    rawYaml = await readFile(scenarioPath, 'utf8');
  } catch (error) {
    throw new ScenarioLoadError(scenarioPath, 'Failed to read scenario file.', { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = parse(rawYaml);
  } catch (error) {
    throw new ScenarioLoadError(scenarioPath, 'Failed to parse scenario YAML.', { cause: error });
  }

  const isValid = Value.Check(scenarioSchema, parsed);
  if (isValid) {
    return mapScenarioInput(parsed as ScenarioInput);
  }

  throw new ScenarioValidationError(scenarioPath, getSchemaErrors(parsed));
};
