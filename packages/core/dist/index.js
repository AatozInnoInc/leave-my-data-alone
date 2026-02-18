// src/scenario/loader.ts
import { readFile } from "fs/promises";
import { Value } from "@sinclair/typebox/value";
import { parse } from "yaml";

// src/scenario/schema.ts
import { Type } from "@sinclair/typebox";
var SeveritySchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical")
]);
var ScenarioMetadataSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    description: Type.Optional(Type.String()),
    severity: SeveritySchema,
    attack_class: Type.String(),
    tags: Type.Optional(Type.Array(Type.String()))
  },
  { additionalProperties: false }
);
var ToolConfigSchema = Type.Object(
  {
    enabled: Type.Array(Type.String()),
    require_confirmation: Type.Optional(Type.Array(Type.String()))
  },
  { additionalProperties: false }
);
var RetrievalConfigSchema = Type.Object(
  {
    type: Type.String(),
    fixture: Type.String()
  },
  { additionalProperties: false }
);
var AgentConfigSchema = Type.Object(
  {
    tools: ToolConfigSchema,
    memory: Type.Boolean(),
    retrieval: Type.Optional(Type.Array(RetrievalConfigSchema))
  },
  { additionalProperties: false }
);
var CanaryFixtureSchema = Type.Object(
  {
    id: Type.String(),
    value: Type.String()
  },
  { additionalProperties: false }
);
var WorkspaceFixtureSchema = Type.Object(
  {
    source: Type.String(),
    target: Type.String()
  },
  { additionalProperties: false }
);
var FixturesSchema = Type.Object(
  {
    canaries: Type.Optional(Type.Array(CanaryFixtureSchema)),
    workspace: Type.Optional(Type.Array(WorkspaceFixtureSchema))
  },
  { additionalProperties: false }
);
var MessageRoleSchema = Type.Union([
  Type.Literal("user"),
  Type.Literal("assistant"),
  Type.Literal("system"),
  Type.Literal("tool")
]);
var MessageSchema = Type.Object(
  {
    role: MessageRoleSchema,
    content: Type.String()
  },
  { additionalProperties: false }
);
var PatternMatchSchema = Type.Object(
  {
    pattern: Type.String()
  },
  { additionalProperties: false }
);
var ArgumentMatchSchema = Type.Recursive(
  (Self) => Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
    PatternMatchSchema,
    Type.Array(Self),
    Type.Record(Type.String(), Self)
  ])
);
var MustNotContainSchema = Type.Object(
  {
    pattern: Type.String()
  },
  { additionalProperties: false }
);
var MustNotCallSchema = Type.Object(
  {
    tool: Type.String(),
    args: Type.Optional(Type.Record(Type.String(), ArgumentMatchSchema))
  },
  { additionalProperties: false }
);
var EncodingTypeSchema = Type.Union([
  Type.Literal("base64"),
  Type.Literal("hex"),
  Type.Literal("zero_width")
]);
var MustNotEncodeSchema = Type.Object(
  {
    type: EncodingTypeSchema,
    of: Type.Optional(Type.Array(Type.String()))
  },
  { additionalProperties: false }
);
var InvariantsSchema = Type.Object(
  {
    must_not_contain: Type.Optional(Type.Array(MustNotContainSchema)),
    must_not_call: Type.Optional(Type.Array(MustNotCallSchema)),
    must_not_encode: Type.Optional(Type.Array(MustNotEncodeSchema))
  },
  { additionalProperties: false }
);
var scenarioSchema = Type.Object(
  {
    metadata: ScenarioMetadataSchema,
    agent_config: AgentConfigSchema,
    fixtures: Type.Optional(FixturesSchema),
    attack: Type.Array(MessageSchema),
    invariants: InvariantsSchema
  },
  { additionalProperties: false }
);

// src/scenario/loader.ts
var ScenarioValidationError = class extends Error {
  scenarioPath;
  validationErrors;
  constructor(scenarioPath, validationErrors) {
    super(`Invalid scenario at ${scenarioPath}: ${validationErrors.join(", ")}`);
    this.name = "ScenarioValidationError";
    this.scenarioPath = scenarioPath;
    this.validationErrors = validationErrors;
  }
};
var ScenarioLoadError = class extends Error {
  scenarioPath;
  constructor(scenarioPath, message, options) {
    super(message, options);
    this.name = "ScenarioLoadError";
    this.scenarioPath = scenarioPath;
  }
};
var mapMetadata = (metadata) => ({
  id: metadata.id,
  name: metadata.name,
  ...metadata.description ? { description: metadata.description } : {},
  severity: metadata.severity,
  attackClass: metadata.attack_class,
  ...metadata.tags ? { tags: metadata.tags } : {}
});
var mapToolConfig = (tools) => ({
  enabled: tools.enabled,
  ...tools.require_confirmation ? { requireConfirmation: tools.require_confirmation } : {}
});
var mapAgentConfig = (agentConfig) => ({
  tools: mapToolConfig(agentConfig.tools),
  memory: agentConfig.memory,
  ...agentConfig.retrieval ? { retrieval: agentConfig.retrieval } : {}
});
var mapFixtures = (fixtures) => {
  if (fixtures) {
    const mappedFixtures = {
      ...fixtures.canaries ? { canaries: fixtures.canaries } : {},
      ...fixtures.workspace ? { workspace: fixtures.workspace } : {}
    };
    return mappedFixtures;
  }
  return void 0;
};
var mapInvariants = (invariants) => ({
  ...invariants.must_not_contain ? { mustNotContain: invariants.must_not_contain } : {},
  ...invariants.must_not_call ? { mustNotCall: invariants.must_not_call } : {},
  ...invariants.must_not_encode ? { mustNotEncode: invariants.must_not_encode } : {}
});
var mapScenarioInput = (input) => {
  const baseConfig = {
    metadata: mapMetadata(input.metadata),
    agentConfig: mapAgentConfig(input.agent_config),
    attack: input.attack,
    invariants: mapInvariants(input.invariants)
  };
  if (input.fixtures) {
    const mappedFixtures = mapFixtures(input.fixtures);
    if (mappedFixtures) {
      return {
        ...baseConfig,
        fixtures: mappedFixtures
      };
    }
  }
  return baseConfig;
};
var getSchemaErrors = (input) => [...Value.Errors(scenarioSchema, input)].map(
  (error) => `${error.path || "scenario"}: ${error.message}`
);
var loadScenario = async (scenarioPath) => {
  let rawYaml;
  try {
    rawYaml = await readFile(scenarioPath, "utf8");
  } catch (error) {
    throw new ScenarioLoadError(scenarioPath, "Failed to read scenario file.", { cause: error });
  }
  let parsed;
  try {
    parsed = parse(rawYaml, { maxAliasCount: 64 });
  } catch (error) {
    throw new ScenarioLoadError(scenarioPath, "Failed to parse scenario YAML.", { cause: error });
  }
  const isValid = Value.Check(scenarioSchema, parsed);
  if (isValid) {
    return mapScenarioInput(parsed);
  }
  throw new ScenarioValidationError(scenarioPath, getSchemaErrors(parsed));
};

// src/shared/type-guards.ts
var isObject = (value) => typeof value === "object" && value !== null;

// src/invariants/matchers/must-not-call.ts
var isPatternMatch = (value) => {
  if (!isObject(value)) {
    return false;
  }
  const record = value;
  return typeof record.pattern === "string" && Object.keys(record).length === 1;
};
var matchArgument = (expected, actual) => {
  if (expected === null || typeof expected !== "object") {
    return Object.is(expected, actual);
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return false;
    }
    return expected.every((entry, index) => matchArgument(entry, actual[index]));
  }
  if (isPatternMatch(expected)) {
    if (typeof actual !== "string") {
      return false;
    }
    try {
      return new RegExp(expected.pattern).test(actual);
    } catch {
      return false;
    }
  }
  if (!isObject(actual) || Array.isArray(actual)) {
    return false;
  }
  const expectedRecord = expected;
  const actualRecord = actual;
  return Object.entries(expectedRecord).every(([key, value]) => {
    if (!(key in actualRecord)) {
      return false;
    }
    return matchArgument(value, actualRecord[key]);
  });
};
var getToolCallPayload = (event) => {
  if (event.type !== "tool_call_start" && event.type !== "tool_call_end") {
    return null;
  }
  if (!isObject(event.payload)) {
    return null;
  }
  const payload = event.payload;
  const tool = typeof payload.tool === "string" ? payload.tool : void 0;
  const args = payload.args;
  return {
    ...tool !== void 0 && { tool },
    ...args !== void 0 && { args }
  };
};
var matchMustNotCall = (invariants, events) => {
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }
  const violations = [];
  for (const event of events) {
    const payload = getToolCallPayload(event);
    if (!payload?.tool) {
      continue;
    }
    for (const invariant of invariants) {
      if (payload.tool !== invariant.tool) {
        continue;
      }
      if (invariant.args && !matchArgument(invariant.args, payload.args)) {
        continue;
      }
      violations.push({
        invariant: "must_not_call",
        event,
        details: `Tool "${invariant.tool}" was called.`
      });
    }
  }
  return violations;
};

// src/invariants/payload-strings.ts
var collectStrings = (value, seen) => {
  if (typeof value === "string") {
    return [value];
  }
  if (!isObject(value)) {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry, seen));
  }
  return Object.values(value).flatMap(
    (entry) => collectStrings(entry, seen)
  );
};
var getPayloadStrings = (event) => collectStrings(event.payload, /* @__PURE__ */ new Set());

// src/invariants/matchers/must-not-contain.ts
var matchMustNotContain = (invariants, events) => {
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }
  const violations = [];
  for (const event of events) {
    const payloadStrings = getPayloadStrings(event);
    for (const invariant of invariants) {
      if (payloadStrings.some((value) => value.includes(invariant.pattern))) {
        violations.push({
          invariant: "must_not_contain",
          event,
          details: `Pattern "${invariant.pattern}" found in telemetry payload.`
        });
      }
    }
  }
  return violations;
};

// src/invariants/encoding.ts
import { Buffer } from "buffer";
var ZERO_BIT = "\u200B";
var ONE_BIT = "\u200C";
var BYTE_SEPARATOR = "\u200D";
var uniqueStrings = (values) => {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const value of values) {
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
};
var encodeBase64Variants = (value) => {
  if (value.length === 0) {
    return [];
  }
  const base64 = Buffer.from(value, "utf8").toString("base64");
  const base64NoPad = base64.replace(/=+$/u, "");
  const base64Url = base64.replace(/\+/gu, "-").replace(/\//gu, "_");
  const base64UrlNoPad = base64Url.replace(/=+$/u, "");
  return uniqueStrings([base64, base64NoPad, base64Url, base64UrlNoPad]);
};
var encodeHexVariants = (value) => {
  if (value.length === 0) {
    return [];
  }
  const hex = Buffer.from(value, "utf8").toString("hex");
  return uniqueStrings([hex, hex.toUpperCase()]);
};
var encodeZeroWidth = (value, separator) => {
  const bytes = Buffer.from(value, "utf8");
  let result = "";
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    if (byteIndex > 0 && separator) {
      result += separator;
    }
    const byte = bytes[byteIndex];
    if (byte === void 0) {
      continue;
    }
    for (let bit = 7; bit >= 0; bit -= 1) {
      const isSet = (byte & 1 << bit) === 0;
      result += isSet ? ZERO_BIT : ONE_BIT;
    }
  }
  return result;
};
var encodeZeroWidthVariants = (value) => {
  if (value.length === 0) {
    return [];
  }
  return uniqueStrings([
    encodeZeroWidth(value, null),
    encodeZeroWidth(value, BYTE_SEPARATOR)
  ]);
};
var getEncodedVariants = (value, encoding) => {
  switch (encoding) {
    case "base64":
      return encodeBase64Variants(value);
    case "hex":
      return encodeHexVariants(value);
    case "zero_width":
      return encodeZeroWidthVariants(value);
  }
};
var containsEncodedValue = (content, value, encoding) => getEncodedVariants(value, encoding).some((variant) => content.includes(variant));

// src/invariants/matchers/must-not-encode.ts
var resolveCandidates = (invariant, candidateValues) => invariant.of ?? candidateValues;
var matchMustNotEncode = (invariants, events, candidateValues) => {
  if (!invariants || invariants.length === 0 || events.length === 0) {
    return [];
  }
  const violations = [];
  for (const event of events) {
    const payloadStrings = getPayloadStrings(event);
    for (const invariant of invariants) {
      const candidates = resolveCandidates(invariant, candidateValues);
      if (candidates.length === 0) {
        continue;
      }
      for (const candidate of candidates) {
        if (payloadStrings.some(
          (content) => containsEncodedValue(content, candidate, invariant.type)
        )) {
          violations.push({
            invariant: "must_not_encode",
            event,
            details: `Encoded value detected for type "${invariant.type}".`
          });
        }
      }
    }
  }
  return violations;
};

// src/invariants/evaluator.ts
var InvariantEvaluator = class {
  candidateValues;
  constructor(options) {
    this.candidateValues = options?.candidateValues ?? [];
  }
  /**
   * Evaluates invariants and returns a consolidated result.
   */
  evaluate(invariants, telemetry) {
    const violations = [];
    violations.push(...matchMustNotContain(invariants.mustNotContain, telemetry));
    violations.push(...matchMustNotCall(invariants.mustNotCall, telemetry));
    violations.push(
      ...matchMustNotEncode(invariants.mustNotEncode, telemetry, this.candidateValues)
    );
    return {
      passed: violations.length === 0,
      violations,
      telemetryAnalyzed: telemetry.length
    };
  }
};

// src/engine/context.ts
var getCandidateValues = (scenario) => (scenario.fixtures?.canaries ?? []).map((canary) => canary.value).filter((value) => value.length > 0);
var createScenarioContext = (options) => {
  const candidateValues = getCandidateValues(options.scenario);
  const evaluator = options.evaluator ?? new InvariantEvaluator({ candidateValues });
  return {
    scenario: options.scenario,
    provider: options.provider,
    evaluator,
    candidateValues
  };
};

// src/engine/runner.ts
var ScenarioExecutionError = class extends Error {
  stage;
  scenarioId;
  constructor(stage, scenarioId, message, options) {
    super(message, options);
    this.name = "ScenarioExecutionError";
    this.stage = stage;
    this.scenarioId = scenarioId;
  }
};
var ScenarioEngine = class {
  provider;
  evaluatorOverride;
  constructor(options) {
    this.provider = options.provider;
    if (options.evaluator !== void 0) {
      this.evaluatorOverride = options.evaluator;
    }
  }
  async run(scenario) {
    const context = createScenarioContext({
      scenario,
      provider: this.provider,
      // Conditional spread: when false, nothing is spread (valid TypeScript idiom for optional props).
      ...this.evaluatorOverride !== void 0 && { evaluator: this.evaluatorOverride }
    });
    await this.configureScenario(context.provider, scenario);
    let telemetry = [];
    let executionError = null;
    try {
      telemetry = await this.collectTelemetry(context.provider, scenario.attack);
    } catch (error) {
      executionError = this.wrapError("execute", scenario, "Failed to execute scenario.", error);
    }
    const teardownError = await this.teardownScenario(context.provider, scenario);
    if (executionError) {
      throw executionError;
    }
    if (teardownError) {
      throw teardownError;
    }
    return context.evaluator.evaluate(scenario.invariants, telemetry);
  }
  async configureScenario(provider, scenario) {
    try {
      await provider.configure(scenario);
    } catch (error) {
      throw this.wrapError("configure", scenario, "Failed to configure provider.", error);
    }
  }
  async collectTelemetry(provider, messages) {
    const events = [];
    for await (const event of provider.execute(messages)) {
      events.push(event);
    }
    return events;
  }
  async teardownScenario(provider, scenario) {
    try {
      await provider.teardown();
    } catch (error) {
      return this.wrapError("teardown", scenario, "Failed to teardown provider.", error);
    }
    return null;
  }
  wrapError(stage, scenario, message, error) {
    return new ScenarioExecutionError(stage, scenario.metadata.id, message, {
      cause: error
    });
  }
};

// src/canary/generator.ts
import { randomBytes } from "crypto";
var DEFAULT_PREFIX = "CANARY";
var DEFAULT_ENTROPY_BYTES = 8;
var resolvePrefix = (prefix) => {
  if (typeof prefix === "string" && prefix.trim().length > 0) {
    return prefix.trim();
  }
  return DEFAULT_PREFIX;
};
var resolveEntropyBytes = (entropyBytes) => {
  if (typeof entropyBytes === "number" && Number.isFinite(entropyBytes) && entropyBytes >= 1) {
    return Math.floor(entropyBytes);
  }
  return DEFAULT_ENTROPY_BYTES;
};
var normalizeId = (id) => {
  const trimmed = id.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  throw new Error("Canary id must be a non-empty string.");
};
var generateCanary = (options) => {
  const id = normalizeId(options.id);
  const prefix = resolvePrefix(options.prefix);
  const entropyBytes = resolveEntropyBytes(options.entropyBytes);
  const entropy = randomBytes(entropyBytes).toString("hex");
  return {
    id,
    value: `${prefix}_${id}_${entropy}`
  };
};

// src/fixtures/provisioner.ts
import { cp, mkdir } from "fs/promises";
import { dirname, resolve, sep } from "path";
var FixtureProvisionError = class extends Error {
  source;
  target;
  constructor(source, target, message, options) {
    super(message, options);
    this.name = "FixtureProvisionError";
    this.source = source;
    this.target = target;
  }
};
var resolveTargetPath = (workspaceRoot, target) => {
  const normalizedTarget = target.startsWith("~") ? target.slice(1) : target;
  const trimmedTarget = normalizedTarget.replace(/^\/+/u, "");
  const resolved = resolve(workspaceRoot, trimmedTarget);
  const isWithinWorkspace = resolved === workspaceRoot || resolved.startsWith(`${workspaceRoot}${sep}`);
  if (isWithinWorkspace) {
    return resolved;
  }
  throw new FixtureProvisionError(
    "<resolved>",
    target,
    `Fixture target "${target}" escapes the workspace root.`
  );
};
var provisionWorkspaceFixture = async (fixture, scenarioRoot, workspaceRoot) => {
  const sourcePath = resolve(scenarioRoot, fixture.source);
  const targetPath = resolveTargetPath(workspaceRoot, fixture.target);
  await mkdir(dirname(targetPath), { recursive: true });
  try {
    await cp(sourcePath, targetPath, { recursive: true });
  } catch (error) {
    throw new FixtureProvisionError(
      fixture.source,
      fixture.target,
      "Failed to provision workspace fixture.",
      { cause: error }
    );
  }
  return {
    source: sourcePath,
    target: targetPath
  };
};
var provisionFixtures = async (options) => {
  const fixtures = options.fixtures;
  const canaries = fixtures?.canaries ?? [];
  const workspaceFixtures = fixtures?.workspace ?? [];
  const provisionedWorkspace = [];
  for (const fixture of workspaceFixtures) {
    const provisioned = await provisionWorkspaceFixture(
      fixture,
      options.scenarioRoot,
      options.workspaceRoot
    );
    provisionedWorkspace.push(provisioned);
  }
  return {
    canaries,
    workspace: provisionedWorkspace
  };
};

// src/telemetry/collector.ts
var TelemetryCollector = class {
  events = [];
  add(event) {
    this.events.push(event);
  }
  list() {
    return [...this.events];
  }
  async collect(provider, messages) {
    for await (const event of provider.execute(messages)) {
      this.add(event);
    }
    return this.list();
  }
};
var collectTelemetry = async (provider, messages) => {
  const collector = new TelemetryCollector();
  return collector.collect(provider, messages);
};

// src/sources/registry.ts
var DEFAULT_SOURCES = [
  {
    id: "jailbreakbench",
    name: "JailbreakBench",
    description: "Structured jailbreak and prompt injection test cases.",
    homepage: "https://github.com/JailbreakBench/JailbreakBench",
    tier: "tier1"
  },
  {
    id: "awesome-jailbreak",
    name: "Awesome Jailbreak on LLMs",
    description: "Academic jailbreak references and datasets.",
    homepage: "https://github.com/yueliu1999/Awesome-Jailbreak-on-LLMs",
    tier: "tier1"
  },
  {
    id: "jailbreak_llms",
    name: "Jailbreak LLMs",
    description: "In-the-wild jailbreak prompts on LLMs.",
    homepage: "https://github.com/verazuo/jailbreak_llms",
    tier: "tier1"
  }
];
var createSourceRegistry = (sources = DEFAULT_SOURCES) => ({
  list: () => [...sources],
  getById: (id) => sources.find((entry) => entry.id === id)
});

// src/sources/sync.ts
import { mkdir as mkdir2 } from "fs/promises";
import { join as join2 } from "path";

// src/sources/adapters/github.ts
import { Buffer as Buffer2 } from "buffer";
import { writeFile } from "fs/promises";
import { join } from "path";
var GitHubDownloadError = class extends Error {
  url;
  constructor(url, message, options) {
    super(message, options);
    this.name = "GitHubDownloadError";
    this.url = url;
  }
};
var DEFAULT_REF = "main";
var sanitizeSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "");
var buildGitHubArchiveUrl = (repo) => {
  const ref = repo.ref ?? DEFAULT_REF;
  return `https://codeload.github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tar.gz/${encodeURIComponent(ref)}`;
};
var resolveFetcher = (fetcher) => {
  if (fetcher !== void 0) {
    return fetcher;
  }
  const globalFetcher = globalThis.fetch;
  if (typeof globalFetcher === "function") {
    return globalFetcher;
  }
  throw new GitHubDownloadError("unknown", "Global fetch is not available.");
};
var downloadGitHubArchive = async (options) => {
  const archiveUrl = buildGitHubArchiveUrl(options.repo);
  const fetcher = resolveFetcher(options.fetcher);
  const response = await fetcher(archiveUrl, {
    headers: {
      "user-agent": "lmda"
    }
  });
  if (response.ok === false) {
    throw new GitHubDownloadError(
      archiveUrl,
      `Failed to download archive (${response.status} ${response.statusText}).`
    );
  }
  const buffer = Buffer2.from(await response.arrayBuffer());
  const ref = options.repo.ref ?? DEFAULT_REF;
  const filename = options.filename ?? `${sanitizeSegment(options.repo.owner)}-${sanitizeSegment(options.repo.repo)}-${sanitizeSegment(ref)}.tar.gz`;
  const archivePath = join(options.outputDir, filename);
  await writeFile(archivePath, buffer);
  return {
    url: archiveUrl,
    archivePath
  };
};
var writeSourceManifest = async (outputDir, manifest) => {
  const manifestPath = join(outputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifestPath;
};

// src/sources/adapters/awesome-jailbreak.ts
var DEFAULT_REF2 = "main";
var createAwesomeJailbreakAdapter = (options = {}) => ({
  id: "awesome-jailbreak",
  sync: async ({ source, outputDir }) => {
    const downloadOptions = {
      repo: {
        owner: "yueliu1999",
        repo: "Awesome-Jailbreak-on-LLMs",
        ref: options.ref ?? DEFAULT_REF2
      },
      outputDir,
      filename: "awesome-jailbreak.tar.gz",
      ...options.fetcher ? { fetcher: options.fetcher } : {}
    };
    const archive = await downloadGitHubArchive(downloadOptions);
    await writeSourceManifest(outputDir, {
      source,
      archiveUrl: archive.url,
      archivePath: archive.archivePath,
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      status: "success",
      message: `Downloaded archive to ${archive.archivePath}.`
    };
  }
});

// src/sources/adapters/jailbreakbench.ts
var DEFAULT_REF3 = "main";
var createJailbreakBenchAdapter = (options = {}) => ({
  id: "jailbreakbench",
  sync: async ({ source, outputDir }) => {
    const downloadOptions = {
      repo: {
        owner: "JailbreakBench",
        repo: "JailbreakBench",
        ref: options.ref ?? DEFAULT_REF3
      },
      outputDir,
      filename: "jailbreakbench.tar.gz",
      ...options.fetcher ? { fetcher: options.fetcher } : {}
    };
    const archive = await downloadGitHubArchive(downloadOptions);
    await writeSourceManifest(outputDir, {
      source,
      archiveUrl: archive.url,
      archivePath: archive.archivePath,
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      status: "success",
      message: `Downloaded archive to ${archive.archivePath}.`
    };
  }
});

// src/sources/adapters/jailbreak-llms.ts
var DEFAULT_REF4 = "main";
var createJailbreakLlmsAdapter = (options = {}) => ({
  id: "jailbreak_llms",
  sync: async ({ source, outputDir }) => {
    const downloadOptions = {
      repo: {
        owner: "verazuo",
        repo: "jailbreak_llms",
        ref: options.ref ?? DEFAULT_REF4
      },
      outputDir,
      filename: "jailbreak-llms.tar.gz",
      ...options.fetcher ? { fetcher: options.fetcher } : {}
    };
    const archive = await downloadGitHubArchive(downloadOptions);
    await writeSourceManifest(outputDir, {
      source,
      archiveUrl: archive.url,
      archivePath: archive.archivePath,
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      status: "success",
      message: `Downloaded archive to ${archive.archivePath}.`
    };
  }
});

// src/sources/adapters/types.ts
var createSourceAdapterRegistry = (adapters = []) => ({
  list: () => [...adapters],
  getById: (id) => adapters.find((adapter) => adapter.id === id)
});

// src/sources/adapters/index.ts
var adapterOptions = (fetcher) => fetcher !== void 0 ? { fetcher } : {};
var createDefaultSourceAdapterRegistry = (options = {}) => createSourceAdapterRegistry([
  createJailbreakBenchAdapter(adapterOptions(options.fetcher)),
  createAwesomeJailbreakAdapter(adapterOptions(options.fetcher)),
  createJailbreakLlmsAdapter(adapterOptions(options.fetcher))
]);

// src/sources/sync.ts
var UnknownSourceError = class extends Error {
  sourceIds;
  constructor(sourceIds) {
    super(`Unknown sources: ${sourceIds.join(", ")}`);
    this.name = "UnknownSourceError";
    this.sourceIds = sourceIds;
  }
};
var selectSources = (registry, sourceIds) => {
  if (sourceIds === void 0 || sourceIds.length === 0) {
    return registry.list();
  }
  const selected = [];
  const missing = [];
  for (const id of sourceIds) {
    const source = registry.getById(id);
    if (source === void 0) {
      missing.push(id);
    } else {
      selected.push(source);
    }
  }
  if (missing.length > 0) {
    throw new UnknownSourceError(missing);
  }
  return selected;
};
var createFailureReport = (source, outputDir, message, startedAt, finishedAt) => ({
  source,
  status: "failure",
  message,
  outputDir,
  startedAt,
  finishedAt
});
var createOutcomeReport = (source, outputDir, outcome, startedAt, finishedAt) => {
  if (typeof outcome.message === "string") {
    return {
      source,
      status: outcome.status,
      message: outcome.message,
      outputDir,
      startedAt,
      finishedAt
    };
  }
  return {
    source,
    status: outcome.status,
    outputDir,
    startedAt,
    finishedAt
  };
};
var syncSource = async (source, outputRoot, adapters) => {
  const adapter = adapters.getById(source.id);
  const outputDir = join2(outputRoot, source.id);
  const startedAt = /* @__PURE__ */ new Date();
  if (adapter === void 0) {
    const finishedAt2 = /* @__PURE__ */ new Date();
    return createFailureReport(
      source,
      outputDir,
      "No adapter registered for source.",
      startedAt,
      finishedAt2
    );
  }
  await mkdir2(outputDir, { recursive: true });
  let outcome;
  try {
    outcome = await adapter.sync({ source, outputDir });
  } catch (error) {
    const finishedAt2 = /* @__PURE__ */ new Date();
    const message = error instanceof Error ? error.message : "Unknown error.";
    return createFailureReport(source, outputDir, message, startedAt, finishedAt2);
  }
  const finishedAt = /* @__PURE__ */ new Date();
  return createOutcomeReport(source, outputDir, outcome, startedAt, finishedAt);
};
var createSummary = (reports, startedAt, finishedAt) => {
  const total = reports.length;
  let succeeded = 0;
  for (const report of reports) {
    if (report.status === "success") {
      succeeded += 1;
    }
  }
  return {
    total,
    succeeded,
    failed: total - succeeded,
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
  };
};
var syncSources = async (options) => {
  const registry = options.registry ?? createSourceRegistry();
  const adapters = options.adapters ?? createDefaultSourceAdapterRegistry();
  const sources = selectSources(registry, options.sourceIds);
  const startedAt = /* @__PURE__ */ new Date();
  await mkdir2(options.rootDir, { recursive: true });
  const reports = [];
  for (const source of sources) {
    const report = await syncSource(source, options.rootDir, adapters);
    reports.push(report);
  }
  const finishedAt = /* @__PURE__ */ new Date();
  return {
    reports,
    summary: createSummary(reports, startedAt, finishedAt),
    startedAt,
    finishedAt
  };
};

// src/reporters/console.ts
var formatDuration = (durationMs) => `${String(durationMs)}ms`;
var formatScenarioHeader = (report) => {
  const status = report.result.passed ? "PASS" : "FAIL";
  const duration = report.finishedAt.getTime() - report.startedAt.getTime();
  return `[${status}] ${report.scenario.metadata.id} (${formatDuration(Math.max(0, duration))})`;
};
var formatScenarioLines = (report) => {
  const lines = [];
  lines.push(formatScenarioHeader(report));
  lines.push(`  Name: ${report.scenario.metadata.name}`);
  lines.push(`  Severity: ${report.scenario.metadata.severity}`);
  if (report.result.violations.length > 0) {
    lines.push("  Violations:");
    for (const violation of report.result.violations) {
      lines.push(
        `    - ${violation.invariant}: ${violation.details} (event: ${violation.event.type})`
      );
    }
  } else {
    lines.push("  Violations: none");
  }
  return lines;
};
var ConsoleReporter = class {
  format = "console";
  report(bundle) {
    const lines = [];
    lines.push("LMDA Report");
    lines.push(`Generated: ${bundle.generatedAt.toISOString()}`);
    lines.push(
      `Summary: ${String(bundle.summary.total)} total,
        ${String(bundle.summary.passed)} passed,
        ${String(bundle.summary.failed)} failed,
        ${formatDuration(bundle.summary.durationMs)}`
    );
    if (bundle.reports.length > 0) {
      lines.push("");
    }
    for (const report of bundle.reports) {
      lines.push(...formatScenarioLines(report));
      lines.push("");
    }
    return {
      format: "console",
      contentType: "text/plain",
      extension: "txt",
      content: lines.join("\n").trimEnd()
    };
  }
};

// src/reporters/json.ts
var JsonReporter = class {
  format = "json";
  report(bundle) {
    const payload = {
      generatedAt: bundle.generatedAt.toISOString(),
      summary: bundle.summary,
      reports: bundle.reports.map((report) => ({
        scenario: {
          metadata: report.scenario.metadata,
          agentConfig: report.scenario.agentConfig,
          fixtures: report.scenario.fixtures,
          attack: report.scenario.attack,
          invariants: report.scenario.invariants
        },
        result: report.result,
        startedAt: report.startedAt.toISOString(),
        finishedAt: report.finishedAt.toISOString()
      }))
    };
    return {
      format: "json",
      contentType: "application/json",
      extension: "json",
      content: JSON.stringify(payload, null, 2)
    };
  }
};

// src/reporters/junit.ts
var escapeXml = (value) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
var formatDurationSeconds = (durationMs) => (Math.max(0, durationMs) / 1e3).toFixed(3);
var getScenarioDurationMs = (report) => Math.max(0, report.finishedAt.getTime() - report.startedAt.getTime());
var buildFailureElements = (report) => {
  if (report.result.violations.length === 0) {
    return [];
  }
  return report.result.violations.map((violation) => {
    const message = `${violation.invariant}: ${violation.details}`;
    const body = `Event: ${violation.event.type}`;
    return `<failure message="${escapeXml(message)}">${escapeXml(body)}</failure>`;
  });
};
var buildTestcaseLines = (report) => {
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
    "  </testcase>"
  ];
};
var JunitReporter = class {
  format = "junit";
  report(bundle) {
    const tests = bundle.summary.total;
    const failures = bundle.summary.failed;
    const time = formatDurationSeconds(bundle.summary.durationMs);
    const timestamp = bundle.generatedAt.toISOString();
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      `<testsuite name="LMDA" tests="${String(tests)}" failures="${String(failures)}" time="${time}" timestamp="${escapeXml(
        timestamp
      )}">`
    );
    if (bundle.reports.length > 0) {
      for (const report of bundle.reports) {
        lines.push(...buildTestcaseLines(report));
      }
    }
    lines.push("</testsuite>");
    return {
      format: "junit",
      contentType: "application/xml",
      extension: "xml",
      content: lines.join("\n")
    };
  }
};

// src/reporters/types.ts
var createReportSummary = (reports) => {
  const total = reports.length;
  let passed = 0;
  let durationMs = 0;
  for (const report of reports) {
    if (report.result.passed) {
      passed += 1;
    }
    const duration = report.finishedAt.getTime() - report.startedAt.getTime();
    durationMs += Math.max(0, duration);
  }
  return {
    total,
    passed,
    failed: total - passed,
    durationMs
  };
};
var createReportBundle = (reports, generatedAt = /* @__PURE__ */ new Date()) => ({
  reports,
  summary: createReportSummary(reports),
  generatedAt
});
export {
  ConsoleReporter,
  FixtureProvisionError,
  InvariantEvaluator,
  JsonReporter,
  JunitReporter,
  ScenarioEngine,
  ScenarioExecutionError,
  ScenarioLoadError,
  ScenarioValidationError,
  TelemetryCollector,
  UnknownSourceError,
  collectTelemetry,
  createDefaultSourceAdapterRegistry,
  createReportBundle,
  createReportSummary,
  createSourceAdapterRegistry,
  createSourceRegistry,
  generateCanary,
  loadScenario,
  provisionFixtures,
  syncSources
};
