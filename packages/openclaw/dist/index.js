// src/shared/type-guards.ts
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var asString = (value) => typeof value === "string" ? value : void 0;
var asNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
var asBoolean = (value) => typeof value === "boolean" ? value : void 0;
var normalizeError = (error) => error instanceof Error ? error : new Error(String(error));

// src/plugin/middleware.ts
var hasHandleEvent = (target) => typeof target.handleEvent === "function";
var createOpenClawMiddleware = (target) => ({
  handleEvent: (event) => {
    if (hasHandleEvent(target)) {
      target.handleEvent(event);
      return;
    }
    target.add(event);
  }
});
var AsyncQueue = class {
  items = [];
  waiters = [];
  closed = false;
  push(value) {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    this.items.push(value);
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const waiter of waiters) {
      waiter({ value: void 0, done: true });
    }
  }
  async next() {
    if (this.items.length > 0) {
      const value = this.items.shift();
      return { value, done: false };
    }
    if (this.closed) {
      return { value: void 0, done: true };
    }
    return new Promise((resolve2) => {
      this.waiters.push(resolve2);
    });
  }
  [Symbol.asyncIterator]() {
    return { next: () => this.next() };
  }
};
var PluginGateway = class {
  options;
  activeQueue = null;
  isExecuting = false;
  constructor(options) {
    this.options = options;
  }
  configure(_scenario) {
    return Promise.resolve();
  }
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
  async *execute(messages) {
    if (this.isExecuting) {
      throw new OpenClawProviderError("plugin", "Plugin gateway is already executing.");
    }
    const runner = this.options.pluginRunner;
    if (!runner) {
      throw new OpenClawProviderError(
        "plugin",
        "Plugin gateway requires a plugin runner to execute scenarios."
      );
    }
    this.isExecuting = true;
    const queue = new AsyncQueue();
    this.activeQueue = queue;
    let runError = null;
    const eventSink = {
      handleEvent: (event) => {
        queue.push(event);
      }
    };
    const runPromise = Promise.resolve().then(() => runner({ messages, eventSink })).catch((error) => {
      runError = normalizeError(error);
    }).finally(() => {
      queue.close();
      this.activeQueue = null;
      this.isExecuting = false;
    });
    for await (const event of queue) {
      yield event;
    }
    await runPromise;
    if (runError) {
      throw new OpenClawProviderError("plugin", "Plugin gateway execution failed.", {
        cause: runError
      });
    }
  }
  teardown() {
    if (this.activeQueue) {
      this.activeQueue.close();
      this.activeQueue = null;
    }
    this.isExecuting = false;
    return Promise.resolve();
  }
};

// src/standalone/gateway.ts
import { randomUUID } from "crypto";

// src/standalone/websocket.ts
import { WebSocket } from "ws";
var OpenClawWebSocketError = class extends Error {
  url;
  constructor(url, message, options) {
    super(message, options);
    this.name = "OpenClawWebSocketError";
    this.url = url;
  }
};
var MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;
var stringifySocketData = (data) => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return "";
    }
    const buffers = data.filter((entry) => Buffer.isBuffer(entry));
    if (buffers.length === data.length) {
      return Buffer.concat(buffers).toString("utf8");
    }
    console.warn("[OpenClaw] WebSocket message array contained non-Buffer entries; treating as unexpected.");
    return String(data);
  }
  if (isRecord(data) && typeof data.toString === "function") {
    return data.toString();
  }
  return String(data);
};
var OpenClawWsClient = class {
  url;
  socket;
  constructor(url, socket) {
    this.url = url;
    this.socket = socket;
  }
  get readyState() {
    return this.socket.readyState;
  }
  onOpen(handler) {
    this.socket.on("open", handler);
  }
  onMessage(handler) {
    this.socket.on("message", (data) => {
      handler(stringifySocketData(data));
    });
  }
  onClose(handler) {
    this.socket.on("close", (code, reason) => {
      handler(code, stringifySocketData(reason));
    });
  }
  onError(handler) {
    this.socket.on("error", (error) => {
      handler(normalizeError(error));
    });
  }
  send(payload) {
    this.socket.send(payload);
  }
  close(code, reason) {
    this.socket.close(code, reason);
  }
};
var createWebSocketClient = (url) => {
  const normalizedUrl = url.trim();
  if (normalizedUrl.length === 0) {
    throw new OpenClawWebSocketError(url, "Gateway URL must be a non-empty value.");
  }
  try {
    const socket = new WebSocket(normalizedUrl, { maxPayload: MAX_PAYLOAD_BYTES });
    return new OpenClawWsClient(normalizedUrl, socket);
  } catch (error) {
    throw new OpenClawWebSocketError(
      normalizedUrl,
      "Failed to create a WebSocket connection for the OpenClaw gateway.",
      { cause: normalizeError(error) }
    );
  }
};

// src/standalone/gateway.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
var DEFAULT_AGENT_ID = "main";
var DEFAULT_MAIN_KEY = "main";
var DEFAULT_CLIENT_ID = "gateway-client";
var DEFAULT_CLIENT_MODE = "backend";
var DEFAULT_CLIENT_VERSION = "0.0.0";
var DEFAULT_CLIENT_PLATFORM = "node";
var DEFAULT_ROLE = "operator";
var DEFAULT_SCOPES = ["operator.admin"];
var PROTOCOL_VERSION = 3;
var CONNECT_DELAY_MS = 750;
var normalizeAgentId = (value) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : DEFAULT_AGENT_ID;
};
var normalizeMainKey = (value) => {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_MAIN_KEY;
};
var buildSessionKey = (agentId, mainKey) => {
  const resolvedAgentId = normalizeAgentId(agentId);
  const resolvedMainKey = normalizeMainKey(mainKey);
  return `agent:${resolvedAgentId}:${resolvedMainKey}`;
};
var buildMessagePlan = (messages) => {
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content.trim()).filter((content) => content.length > 0);
  const supplementalMessages = messages.filter((message) => message.role === "assistant" || message.role === "tool").map((message) => ({
    role: message.role,
    content: message.content.trim()
  })).filter((message) => message.content.length > 0).map((message) => `${message.role}: ${message.content}`);
  const extraSystemPromptParts = [...systemMessages, ...supplementalMessages];
  const extraSystemPrompt = extraSystemPromptParts.length > 0 ? extraSystemPromptParts.join("\n\n") : void 0;
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content.trim()).filter((content) => content.length > 0);
  return {
    userMessages,
    ...extraSystemPrompt !== void 0 && { extraSystemPrompt }
  };
};
var parseGatewayFrame = (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const type = asString(parsed.type);
  if (type === "res") {
    const id = asString(parsed.id);
    const ok = asBoolean(parsed.ok);
    if (!id || ok === void 0) {
      return null;
    }
    return {
      type: "res",
      id,
      ok,
      payload: parsed.payload,
      ...isRecord(parsed.error) && { error: parsed.error }
    };
  }
  if (type === "event") {
    const event = asString(parsed.event);
    if (!event) {
      return null;
    }
    const seq = asNumber(parsed.seq);
    return {
      type: "event",
      event,
      payload: parsed.payload,
      ...seq !== void 0 && { seq }
    };
  }
  return null;
};
var parseAgentEventPayload = (payload) => {
  if (!isRecord(payload)) {
    return null;
  }
  const runId = asString(payload.runId);
  const stream = asString(payload.stream);
  const ts = asNumber(payload.ts);
  const data = isRecord(payload.data) ? payload.data : void 0;
  const seq = asNumber(payload.seq);
  if (!runId || !stream || ts === void 0 || !data) {
    return null;
  }
  return {
    runId,
    stream,
    ts,
    data,
    ...seq !== void 0 && { seq }
  };
};
var createTelemetryEvent = (timestampMs, type, payload) => ({
  timestamp: new Date(timestampMs),
  type,
  payload
});
var MAX_EVENT_QUEUE_SIZE = 5e4;
var AsyncQueue2 = class {
  items = [];
  waiters = [];
  closed = false;
  push(value) {
    if (this.closed) {
      console.warn("[OpenClaw] Dropped agent event: event queue is already closed.");
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    if (this.items.length >= MAX_EVENT_QUEUE_SIZE) {
      this.items.shift();
      console.warn("[OpenClaw] Event queue at capacity; dropped oldest event.");
    }
    this.items.push(value);
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const waiter of waiters) {
      waiter({ value: void 0, done: true });
    }
  }
  async next() {
    if (this.items.length > 0) {
      const value = this.items.shift();
      return { value, done: false };
    }
    if (this.closed) {
      return { value: void 0, done: true };
    }
    return new Promise((resolve2) => {
      this.waiters.push(resolve2);
    });
  }
  [Symbol.asyncIterator]() {
    return { next: () => this.next() };
  }
};
var OpenClawGatewayClient = class {
  constructor(options) {
    this.options = options;
    this.socket = createWebSocketClient(options.url);
    this.socket.onOpen(() => {
      this.isOpen = true;
      if (this.connectRequested) {
        this.queueConnect();
      }
    });
    this.socket.onMessage((data) => {
      this.handleMessage(data);
    });
    this.socket.onClose((code, reason) => {
      this.isOpen = false;
      this.handleClose(code, reason);
    });
    this.socket.onError((error) => {
      this.handleError(error);
    });
  }
  socket;
  pending = /* @__PURE__ */ new Map();
  eventQueue = new AsyncQueue2();
  connectTimer = null;
  connectRequested = false;
  connectSent = false;
  isOpen = false;
  connectPromise = null;
  connectResolve = null;
  connectReject = null;
  get events() {
    return this.eventQueue;
  }
  async connect() {
    this.connectRequested = true;
    if (!this.connectPromise) {
      this.connectPromise = new Promise((resolve2, reject) => {
        this.connectResolve = resolve2;
        this.connectReject = reject;
      });
    }
    if (this.isOpen) {
      this.queueConnect();
    }
    return this.connectPromise;
  }
  async request(method, params, opts) {
    if (!this.isOpen) {
      throw new Error("OpenClaw gateway is not connected.");
    }
    const id = randomUUID();
    const frame = params ? { type: "req", id, method, params } : { type: "req", id, method };
    const expectFinal = opts?.expectFinal === true;
    const response = new Promise((resolve2, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve2(value),
        reject,
        expectFinal
      });
    });
    this.socket.send(JSON.stringify(frame));
    return response;
  }
  close() {
    this.eventQueue.close();
    this.socket.close();
    this.flushPendingErrors(new Error("OpenClaw gateway closed."));
  }
  queueConnect() {
    if (this.connectSent) {
      return;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      this.sendConnect();
    }, CONNECT_DELAY_MS);
  }
  sendConnect() {
    if (this.connectSent || !this.isOpen) {
      return;
    }
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const params = this.buildConnectParams();
    void this.request("connect", params).then(() => {
      this.connectResolve?.();
      this.connectResolve = null;
      this.connectReject = null;
    }).catch((error) => {
      this.connectReject?.(normalizeError(error));
      this.connectResolve = null;
      this.connectReject = null;
    });
  }
  buildConnectParams() {
    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.options.clientId,
        version: this.options.clientVersion,
        platform: this.options.platform,
        mode: this.options.clientMode
      },
      role: this.options.role,
      scopes: this.options.scopes
    };
    if (this.options.authToken) {
      params.auth = { token: this.options.authToken };
    }
    return params;
  }
  handleMessage(raw) {
    const frame = parseGatewayFrame(raw);
    if (!frame) {
      return;
    }
    if (frame.type === "event") {
      if (frame.event === "connect.challenge") {
        this.connectSent = false;
        this.sendConnect();
        return;
      }
      if (frame.event === "agent") {
        const payload = parseAgentEventPayload(frame.payload);
        if (payload) {
          this.eventQueue.push(payload);
        }
      }
      return;
    }
    if (frame.type === "res") {
      const pending = this.pending.get(frame.id);
      if (!pending) {
        return;
      }
      const payloadRecord = isRecord(frame.payload) ? frame.payload : void 0;
      const status = payloadRecord ? asString(payloadRecord.status) : void 0;
      if (pending.expectFinal && status === "accepted") {
        return;
      }
      this.pending.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
        return;
      }
      const message = frame.error && typeof frame.error.message === "string" ? frame.error.message : "OpenClaw gateway request failed.";
      pending.reject(new Error(message));
    }
  }
  handleClose(code, reason) {
    const message = `OpenClaw gateway closed (${String(code)}): ${reason}`;
    this.eventQueue.close();
    this.flushPendingErrors(new Error(message));
    if (this.connectReject) {
      this.connectReject(new Error(message));
      this.connectResolve = null;
      this.connectReject = null;
    }
  }
  handleError(error) {
    if (this.connectReject) {
      this.connectReject(error);
      this.connectResolve = null;
      this.connectReject = null;
    }
  }
  flushPendingErrors(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
};
var StandaloneGateway = class {
  options;
  client = null;
  constructor(options) {
    this.options = options;
  }
  configure(_scenario) {
    return Promise.resolve();
  }
  async *execute(messages) {
    const plan = buildMessagePlan(messages);
    if (plan.userMessages.length === 0) {
      throw new OpenClawProviderError(
        "standalone",
        "OpenClaw scenarios require at least one user message."
      );
    }
    const gatewayUrl = this.options.gatewayUrl?.trim() || DEFAULT_GATEWAY_URL;
    const clientOptions = {
      url: gatewayUrl,
      ...this.options.authToken !== void 0 && { authToken: this.options.authToken },
      clientId: DEFAULT_CLIENT_ID,
      clientMode: DEFAULT_CLIENT_MODE,
      clientVersion: DEFAULT_CLIENT_VERSION,
      platform: typeof process === "object" ? process.platform : DEFAULT_CLIENT_PLATFORM,
      role: DEFAULT_ROLE,
      scopes: [...DEFAULT_SCOPES]
    };
    const client = new OpenClawGatewayClient(clientOptions);
    this.client = client;
    try {
      await client.connect();
      const agentId = this.options.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionKey = this.options.sessionKey?.trim() || buildSessionKey(agentId);
      for (const message of plan.userMessages) {
        const runId = randomUUID();
        const params = {
          message,
          idempotencyKey: runId
        };
        if (plan.extraSystemPrompt) {
          params.extraSystemPrompt = plan.extraSystemPrompt;
        }
        params.sessionKey = sessionKey;
        if (this.options.sessionKey) {
        } else {
          params.agentId = agentId;
        }
        const responsePromise = client.request("agent", params, { expectFinal: true });
        const toolArgsByCallId = /* @__PURE__ */ new Map();
        let lastAssistantText;
        let lastAssistantTimestamp;
        let runError = null;
        let runDone = false;
        for await (const event of client.events) {
          if (event.runId !== runId) {
            continue;
          }
          const timestamp = event.ts;
          if (event.stream === "tool") {
            const phase = asString(event.data.phase);
            const toolName = asString(event.data.name);
            const toolCallId = asString(event.data.toolCallId);
            if (phase === "start" && toolName) {
              const args = event.data.args;
              if (toolCallId) {
                toolArgsByCallId.set(toolCallId, args);
              }
              yield createTelemetryEvent(timestamp, "tool_call_start", {
                tool: toolName,
                args,
                toolCallId
              });
            }
            if (phase === "result" && toolName) {
              const args = toolCallId ? toolArgsByCallId.get(toolCallId) : void 0;
              const isError = asBoolean(event.data.isError);
              const result = event.data.result;
              const meta = event.data.meta;
              if (toolCallId) {
                toolArgsByCallId.delete(toolCallId);
              }
              const payload = {
                tool: toolName,
                args,
                toolCallId,
                result
              };
              if (isError !== void 0) {
                payload.isError = isError;
              }
              if (meta !== void 0) {
                payload.meta = meta;
              }
              yield createTelemetryEvent(timestamp, "tool_call_end", payload);
            }
          }
          if (event.stream === "assistant") {
            const text = asString(event.data.text);
            const delta = asString(event.data.delta);
            if (text) {
              lastAssistantText = text;
              lastAssistantTimestamp = timestamp;
            }
            if (delta) {
              const payload = { content: delta };
              if (text) {
                payload.fullContent = text;
              }
              yield createTelemetryEvent(timestamp, "llm_output_chunk", payload);
            }
          }
          if (event.stream === "lifecycle") {
            const phase = asString(event.data.phase);
            if (phase === "error") {
              const errorMessage = asString(event.data.error);
              runError = new OpenClawProviderError(
                "standalone",
                errorMessage ? `OpenClaw run failed: ${errorMessage}` : "OpenClaw run failed."
              );
              runDone = true;
            }
            if (phase === "end") {
              runDone = true;
            }
          }
          if (runDone) {
            break;
          }
        }
        if (lastAssistantText) {
          const outputTimestamp = lastAssistantTimestamp ?? Date.now();
          yield createTelemetryEvent(outputTimestamp, "llm_output", {
            content: lastAssistantText
          });
        }
        try {
          await responsePromise;
        } catch (responseError) {
          if (!runError) {
            throw responseError;
          }
        }
        if (runError) {
          throw runError;
        }
      }
    } catch (error) {
      if (error instanceof OpenClawProviderError) {
        throw error;
      }
      throw new OpenClawProviderError(
        "standalone",
        "OpenClaw standalone execution failed.",
        { cause: normalizeError(error) }
      );
    } finally {
      client.close();
      this.client = null;
    }
  }
  teardown() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    return Promise.resolve();
  }
};

// src/provider.ts
var OpenClawProviderError = class extends Error {
  mode;
  constructor(mode, message, options) {
    super(message, options);
    this.name = "OpenClawProviderError";
    this.mode = mode;
  }
};
var validateWorkspaceRoot = (workspaceRoot, mode) => {
  if (workspaceRoot.trim().length > 0) {
    return;
  }
  throw new OpenClawProviderError(mode, "Workspace root must be a non-empty path.");
};
var OpenClawProvider = class {
  adapter;
  constructor(options) {
    validateWorkspaceRoot(options.workspaceRoot, options.mode);
    if (options.mode === "standalone") {
      this.adapter = new StandaloneGateway(options);
      return;
    }
    this.adapter = new PluginGateway(options);
  }
  configure(scenario) {
    return this.adapter.configure(scenario);
  }
  execute(messages) {
    return this.adapter.execute(messages);
  }
  teardown() {
    return this.adapter.teardown();
  }
};

// src/plugin/skill.ts
import { isAbsolute, resolve } from "path";
import {
  ConsoleReporter,
  InvariantEvaluator,
  JunitReporter,
  JsonReporter,
  ScenarioEngine,
  createReportBundle,
  loadScenario
} from "@lmda/core";
var OpenClawSkillError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OpenClawSkillError";
  }
};
var REPORTER_FORMATS = ["console", "json", "junit"];
var isReporterFormat = (value) => REPORTER_FORMATS.includes(value);
var createReporter = (format) => {
  if (format === "json") {
    return new JsonReporter();
  }
  if (format === "junit") {
    return new JunitReporter();
  }
  return new ConsoleReporter();
};
var createScenarioReport = (scenario, result, startedAt, finishedAt) => ({
  scenario,
  result,
  startedAt,
  finishedAt
});
var resolveScenarioPath = (scenarioPath, scenarioRoot) => {
  if (isAbsolute(scenarioPath)) {
    return scenarioPath;
  }
  if (scenarioRoot && scenarioRoot.trim().length > 0) {
    return resolve(scenarioRoot, scenarioPath);
  }
  return scenarioPath;
};
var parseSkillRequest = (input) => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new OpenClawSkillError("Skill input must include a scenario path.");
  }
  if (trimmed.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new OpenClawSkillError("Skill input JSON is invalid.", {
        cause: error
      });
    }
    if (!isRecord(parsed)) {
      throw new OpenClawSkillError("Skill input must be a JSON object.");
    }
    const scenarioPathValue = asString(parsed.scenarioPath);
    const scenarioPath = scenarioPathValue ? scenarioPathValue.trim() : "";
    if (scenarioPath.length === 0) {
      throw new OpenClawSkillError("Skill input must include a scenarioPath.");
    }
    const reporterValue = parsed.reporterFormat;
    if (reporterValue === void 0) {
      return { scenarioPath };
    }
    if (isReporterFormat(reporterValue)) {
      return { scenarioPath, reporterFormat: reporterValue };
    }
    throw new OpenClawSkillError("Skill input reporterFormat is invalid.");
  }
  return { scenarioPath: trimmed };
};
var runScenario = async (options) => {
  const scenario = await loadScenario(options.scenarioPath);
  const provider = new OpenClawProvider({
    mode: "plugin",
    workspaceRoot: options.workspaceRoot,
    pluginRunner: options.pluginRunner
  });
  const evaluator = new InvariantEvaluator({
    candidateValues: (scenario.fixtures?.canaries ?? []).map((canary) => canary.value)
  });
  const engine = new ScenarioEngine({ provider, evaluator });
  const reporter = createReporter(options.reporterFormat);
  const startedAt = /* @__PURE__ */ new Date();
  const result = await engine.run(scenario);
  const finishedAt = /* @__PURE__ */ new Date();
  const report = createScenarioReport(scenario, result, startedAt, finishedAt);
  const bundle = createReportBundle([report]);
  return reporter.report(bundle);
};
var createLmdaSkill = (options) => ({
  name: "lmda",
  description: "Runs LMDA security checks for OpenClaw agents.",
  execute: async (input) => {
    if (!options) {
      throw new OpenClawSkillError("LMDA skill is not configured.");
    }
    const workspaceRoot = options.workspaceRoot.trim();
    if (workspaceRoot.length === 0) {
      throw new OpenClawSkillError("LMDA skill requires a workspaceRoot.");
    }
    const request = parseSkillRequest(input);
    const scenarioPath = resolveScenarioPath(request.scenarioPath, options.scenarioRoot);
    const reporterFormat = request.reporterFormat ?? options.defaultReporter ?? "console";
    try {
      const output = await runScenario({
        scenarioPath,
        reporterFormat,
        workspaceRoot,
        pluginRunner: options.pluginRunner
      });
      return output.content;
    } catch (error) {
      throw new OpenClawSkillError("LMDA skill execution failed.", {
        cause: normalizeError(error)
      });
    }
  }
});

// src/standalone/session-parser.ts
var TELEMETRY_EVENT_TYPES = [
  "tool_call_start",
  "tool_call_end",
  "llm_output",
  "llm_output_chunk",
  "memory_read",
  "memory_write",
  "retrieval_inject",
  "user_confirmation_requested",
  "user_confirmation_response"
];
var isTelemetryEventType = (value) => TELEMETRY_EVENT_TYPES.includes(value);
var coerceTimestamp = (value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  console.warn("[OpenClaw] Session line has invalid or missing timestamp; skipping.", { value });
  return null;
};
var parseSessionLine = (line) => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const typeValue = parsed.type;
  if (typeof typeValue !== "string") {
    return null;
  }
  if (!isTelemetryEventType(typeValue)) {
    return null;
  }
  const timestamp = coerceTimestamp(parsed.timestamp);
  if (timestamp === null) {
    return null;
  }
  const payload = isRecord(parsed.payload) ? parsed.payload : {};
  return {
    timestamp,
    type: typeValue,
    payload
  };
};

// src/telemetry/mapper.ts
var mapOpenClawTelemetryEvent = (event) => ({
  timestamp: event.timestamp,
  type: event.type,
  payload: event.payload
});
export {
  OpenClawProvider,
  OpenClawProviderError,
  OpenClawSkillError,
  OpenClawWebSocketError,
  PluginGateway,
  StandaloneGateway,
  createLmdaSkill,
  createOpenClawMiddleware,
  createWebSocketClient,
  mapOpenClawTelemetryEvent,
  parseSessionLine
};
