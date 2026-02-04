// TypeBox schema for scenario YAML validation.

import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

const SeveritySchema = Type.Union([
  Type.Literal('low'),
  Type.Literal('medium'),
  Type.Literal('high'),
  Type.Literal('critical'),
]);

const ScenarioMetadataSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    description: Type.Optional(Type.String()),
    severity: SeveritySchema,
    attack_class: Type.String(),
    tags: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const ToolConfigSchema = Type.Object(
  {
    enabled: Type.Array(Type.String()),
    require_confirmation: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const RetrievalConfigSchema = Type.Object(
  {
    type: Type.String(),
    fixture: Type.String(),
  },
  { additionalProperties: false },
);

const AgentConfigSchema = Type.Object(
  {
    tools: ToolConfigSchema,
    memory: Type.Boolean(),
    retrieval: Type.Optional(Type.Array(RetrievalConfigSchema)),
  },
  { additionalProperties: false },
);

const CanaryFixtureSchema = Type.Object(
  {
    id: Type.String(),
    value: Type.String(),
  },
  { additionalProperties: false },
);

const WorkspaceFixtureSchema = Type.Object(
  {
    source: Type.String(),
    target: Type.String(),
  },
  { additionalProperties: false },
);

const FixturesSchema = Type.Object(
  {
    canaries: Type.Optional(Type.Array(CanaryFixtureSchema)),
    workspace: Type.Optional(Type.Array(WorkspaceFixtureSchema)),
  },
  { additionalProperties: false },
);

const MessageRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('assistant'),
  Type.Literal('system'),
  Type.Literal('tool'),
]);

const MessageSchema = Type.Object(
  {
    role: MessageRoleSchema,
    content: Type.String(),
  },
  { additionalProperties: false },
);

const PatternMatchSchema = Type.Object(
  {
    pattern: Type.String(),
  },
  { additionalProperties: false },
);

const ArgumentMatchSchema = Type.Recursive((Self) =>
  Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
    PatternMatchSchema,
    Type.Array(Self),
    Type.Record(Type.String(), Self),
  ]),
);

const MustNotContainSchema = Type.Object(
  {
    pattern: Type.String(),
  },
  { additionalProperties: false },
);

const MustNotCallSchema = Type.Object(
  {
    tool: Type.String(),
    args: Type.Optional(Type.Record(Type.String(), ArgumentMatchSchema)),
  },
  { additionalProperties: false },
);

const EncodingTypeSchema = Type.Union([
  Type.Literal('base64'),
  Type.Literal('hex'),
  Type.Literal('zero_width'),
]);

const MustNotEncodeSchema = Type.Object(
  {
    type: EncodingTypeSchema,
    of: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const InvariantsSchema = Type.Object(
  {
    must_not_contain: Type.Optional(Type.Array(MustNotContainSchema)),
    must_not_call: Type.Optional(Type.Array(MustNotCallSchema)),
    must_not_encode: Type.Optional(Type.Array(MustNotEncodeSchema)),
  },
  { additionalProperties: false },
);

export const scenarioSchema = Type.Object(
  {
    metadata: ScenarioMetadataSchema,
    agent_config: AgentConfigSchema,
    fixtures: Type.Optional(FixturesSchema),
    attack: Type.Array(MessageSchema),
    invariants: InvariantsSchema,
  },
  { additionalProperties: false },
);

export type ScenarioInput = Static<typeof scenarioSchema>;
