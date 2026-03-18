// Standalone gateway adapter for OpenClaw.

import { randomUUID } from 'node:crypto';

import type { Message, ScenarioConfig, TelemetryEvent, TelemetryEventType } from '@lmda/core';

import type { OpenClawAdapter, OpenClawProviderOptions } from '../provider.js';
import { OpenClawProviderError } from '../provider.js';
import {
  asBoolean,
  asNumber,
  asString,
  isRecord,
  normalizeError,
} from '../shared/type-guards.js';
import type { OpenClawWebSocketClient } from './websocket.js';
import { createWebSocketClient } from './websocket.js';

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';
const DEFAULT_AGENT_ID = 'main';
const DEFAULT_MAIN_KEY = 'main';
const DEFAULT_CLIENT_ID = 'gateway-client';
const DEFAULT_CLIENT_MODE = 'backend';
const DEFAULT_CLIENT_VERSION = '0.0.0';
const DEFAULT_CLIENT_PLATFORM = 'node';
const DEFAULT_ROLE = 'operator';
const DEFAULT_SCOPES = ['operator.admin'] as const;
const PROTOCOL_VERSION = 3;
const CONNECT_DELAY_MS = 750;

interface GatewayRequestFrame {
  readonly type: 'req';
  readonly id: string;
  readonly method: string;
  readonly params?: unknown;
}

interface GatewayResponseFrame {
  readonly type: 'res';
  readonly id: string;
  readonly ok: boolean;
  readonly payload?: unknown;
  readonly error?: {
    readonly message?: unknown;
  };
}

interface GatewayEventFrame {
  readonly type: 'event';
  readonly event: string;
  readonly payload?: unknown;
  readonly seq?: number;
}

interface AgentEventPayload {
  readonly runId: string;
  readonly seq?: number;
  readonly stream: string;
  readonly ts: number;
  readonly data: Record<string, unknown>;
}

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly expectFinal: boolean;
}

interface GatewayClientOptions {
  readonly url: string;
  readonly authToken?: string;
  readonly clientId: string;
  readonly clientMode: string;
  readonly clientVersion: string;
  readonly platform: string;
  readonly role: string;
  readonly scopes: readonly string[];
}

interface MessagePlan {
  readonly userMessages: readonly string[];
  readonly extraSystemPrompt?: string;
}

const normalizeAgentId = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : DEFAULT_AGENT_ID;
};

const normalizeMainKey = (value: string | undefined): string => {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : DEFAULT_MAIN_KEY;
};

const buildSessionKey = (agentId: string, mainKey?: string): string => {
  const resolvedAgentId = normalizeAgentId(agentId);
  const resolvedMainKey = normalizeMainKey(mainKey);
  return `agent:${resolvedAgentId}:${resolvedMainKey}`;
};

const buildMessagePlan = (messages: readonly Message[]): MessagePlan => {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);

  const supplementalMessages = messages
    .filter((message) => message.role === 'assistant' || message.role === 'tool')
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .map((message) => `${message.role}: ${message.content}`);

  const extraSystemPromptParts = [...systemMessages, ...supplementalMessages];
  const extraSystemPrompt =
    extraSystemPromptParts.length > 0 ? extraSystemPromptParts.join('\n\n') : undefined;

  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);

  return {
    userMessages,
    ...(extraSystemPrompt !== undefined && { extraSystemPrompt }),
  };
};

const parseGatewayFrame = (raw: string): GatewayResponseFrame | GatewayEventFrame | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const type = asString(parsed.type);
  if (type === 'res') {
    const id = asString(parsed.id);
    const ok = asBoolean(parsed.ok);
    if (!id || ok === undefined) {
      return null;
    }
    return {
      type: 'res',
      id,
      ok,
      payload: parsed.payload,
      ...(isRecord(parsed.error) && { error: parsed.error }),
    };
  }

  if (type === 'event') {
    const event = asString(parsed.event);
    if (!event) {
      return null;
    }
    const seq = asNumber(parsed.seq);
    return {
      type: 'event',
      event,
      payload: parsed.payload,
      ...(seq !== undefined && { seq }),
    };
  }

  return null;
};

const parseAgentEventPayload = (payload: unknown): AgentEventPayload | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const runId = asString(payload.runId);
  const stream = asString(payload.stream);
  const ts = asNumber(payload.ts);
  const data = isRecord(payload.data) ? payload.data : undefined;
  const seq = asNumber(payload.seq);

  if (!runId || !stream || ts === undefined || !data) {
    return null;
  }

  return {
    runId,
    stream,
    ts,
    data,
    ...(seq !== undefined && { seq }),
  };
};

const createTelemetryEvent = (
  timestampMs: number,
  type: TelemetryEventType,
  payload: Record<string, unknown>,
): TelemetryEvent => ({
  timestamp: new Date(timestampMs),
  type,
  payload,
});

/** Maximum number of queued agent events; prevents unbounded growth when consumer is slow. */
const MAX_EVENT_QUEUE_SIZE = 50_000;

class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: ((result: IteratorResult<T>) => void)[] = [];
  private closed = false;

  public push(value: T): void {
    if (this.closed) {
      console.warn('[OpenClaw] Dropped agent event: event queue is already closed.');
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    if (this.items.length >= MAX_EVENT_QUEUE_SIZE) {
      this.items.shift();
      console.warn('[OpenClaw] Event queue at capacity; dropped oldest event.');
    }
    this.items.push(value);
  }

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const waiter of waiters) {
      waiter({ value: undefined as T, done: true });
    }
  }

  public async next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      const value = this.items.shift() as T;
      return { value, done: false };
    }
    if (this.closed) {
      return { value: undefined as T, done: true };
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  public [Symbol.asyncIterator](): AsyncIterator<T> {
    return { next: () => this.next() };
  }
}

class OpenClawGatewayClient {
  private readonly socket: OpenClawWebSocketClient;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly eventQueue = new AsyncQueue<AgentEventPayload>();
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectRequested = false;
  private connectSent = false;
  private isOpen = false;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  constructor(private readonly options: GatewayClientOptions) {
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

  public get events(): AsyncIterable<AgentEventPayload> {
    return this.eventQueue;
  }

  public async connect(): Promise<void> {
    this.connectRequested = true;
    this.connectPromise ??= new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    });
    if (this.isOpen) {
      this.queueConnect();
    }
    return this.connectPromise;
  }

  public async request<T>(method: string, params?: unknown, opts?: { expectFinal?: boolean }): Promise<T> {
    if (!this.isOpen) {
      throw new Error('OpenClaw gateway is not connected.');
    }
    const id = randomUUID();
    const frame: GatewayRequestFrame = params
      ? { type: 'req', id, method, params }
      : { type: 'req', id, method };
    const expectFinal = opts?.expectFinal === true;

    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => { resolve(value as T); },
        reject,
        expectFinal,
      });
    });

    this.socket.send(JSON.stringify(frame));
    return response;
  }

  public close(): void {
    this.eventQueue.close();
    this.socket.close();
    this.flushPendingErrors(new Error('OpenClaw gateway closed.'));
  }

  private queueConnect(): void {
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

  private sendConnect(): void {
    if (this.connectSent || !this.isOpen) {
      return;
    }
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const params = this.buildConnectParams();
    void this.request('connect', params)
      .then(() => {
        this.connectResolve?.();
        this.connectResolve = null;
        this.connectReject = null;
      })
      .catch((error: unknown) => {
        this.connectReject?.(normalizeError(error));
        this.connectResolve = null;
        this.connectReject = null;
      });
  }

  private buildConnectParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.options.clientId,
        version: this.options.clientVersion,
        platform: this.options.platform,
        mode: this.options.clientMode,
      },
      role: this.options.role,
      scopes: this.options.scopes,
    };
    if (this.options.authToken) {
      params.auth = { token: this.options.authToken };
    }
    return params;
  }

  private handleMessage(raw: string): void {
    const frame = parseGatewayFrame(raw);
    if (!frame) {
      return;
    }

    if (frame.type === 'event') {
      // Challenge can be sent at handshake or later (e.g. re-auth). Reset so sendConnect runs again.
      if (frame.event === 'connect.challenge') {
        this.connectSent = false;
        this.sendConnect();
        return;
      }
      if (frame.event === 'agent') {
        const payload = parseAgentEventPayload(frame.payload);
        if (payload) {
          this.eventQueue.push(payload);
        }
      }
      return;
    }

    const pending = this.pending.get(frame.id);
    if (!pending) {
      return;
    }

    const payloadRecord = isRecord(frame.payload) ? frame.payload : undefined;
    const status = payloadRecord ? asString(payloadRecord.status) : undefined;
    if (pending.expectFinal && status === 'accepted') {
      return;
    }

    this.pending.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
      return;
    }
    const message =
      frame.error && typeof frame.error.message === 'string'
        ? frame.error.message
        : 'OpenClaw gateway request failed.';
    pending.reject(new Error(message));
  }

  private handleClose(code: number, reason: string): void {
    const message = `OpenClaw gateway closed (${String(code)}): ${reason}`;
    this.eventQueue.close();
    this.flushPendingErrors(new Error(message));
    if (this.connectReject) {
      this.connectReject(new Error(message));
      this.connectResolve = null;
      this.connectReject = null;
    }
  }

  private handleError(error: Error): void {
    if (this.connectReject) {
      this.connectReject(error);
      this.connectResolve = null;
      this.connectReject = null;
    }
  }

  private flushPendingErrors(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

/**
 * Adapter that connects to an external OpenClaw gateway.
 */
export class StandaloneGateway implements OpenClawAdapter {
  private readonly options: OpenClawProviderOptions;
  private client: OpenClawGatewayClient | null = null;

  constructor(options: OpenClawProviderOptions) {
    this.options = options;
  }

  public configure(_scenario: ScenarioConfig): Promise<void> {
    return Promise.resolve();
  }

  public async *execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    const plan = buildMessagePlan(messages);
    if (plan.userMessages.length === 0) {
      throw new OpenClawProviderError(
        'standalone',
        'OpenClaw scenarios require at least one user message.',
      );
    }

    const configuredGatewayUrl = this.options.gatewayUrl?.trim();
    const gatewayUrl =
      configuredGatewayUrl && configuredGatewayUrl.length > 0
        ? configuredGatewayUrl
        : DEFAULT_GATEWAY_URL;
    const clientOptions: GatewayClientOptions = {
      url: gatewayUrl,
      ...(this.options.authToken !== undefined && { authToken: this.options.authToken }),
      clientId: DEFAULT_CLIENT_ID,
      clientMode: DEFAULT_CLIENT_MODE,
      clientVersion: DEFAULT_CLIENT_VERSION,
      platform: typeof process === 'object' ? process.platform : DEFAULT_CLIENT_PLATFORM,
      role: DEFAULT_ROLE,
      scopes: [...DEFAULT_SCOPES],
    };

    const client = new OpenClawGatewayClient(clientOptions);
    this.client = client;

    try {
      await client.connect();

      const configuredAgentId = this.options.agentId?.trim();
      const agentId =
        configuredAgentId && configuredAgentId.length > 0
          ? configuredAgentId
          : DEFAULT_AGENT_ID;
      const configuredSessionKey = this.options.sessionKey?.trim();
      const sessionKey =
        configuredSessionKey && configuredSessionKey.length > 0
          ? configuredSessionKey
          : buildSessionKey(agentId);

      for (const message of plan.userMessages) {
        const runId = randomUUID();
        const params: Record<string, unknown> = {
          message,
          idempotencyKey: runId,
        };

        if (plan.extraSystemPrompt) {
          params.extraSystemPrompt = plan.extraSystemPrompt;
        }

        params.sessionKey = sessionKey;
        // Explicit session key provided by caller?
        if (!this.options.sessionKey) {
          params.agentId = agentId;
        }

        const responsePromise = client.request('agent', params, { expectFinal: true });
        const toolArgsByCallId = new Map<string, unknown>();
        let lastAssistantText: string | undefined;
        let lastAssistantTimestamp: number | undefined;
        let runError: Error | null = null;
        let runDone = false;

        for await (const event of client.events) {
          if (event.runId !== runId) {
            continue;
          }

          const timestamp = event.ts;

          if (event.stream === 'tool') {
            const phase = asString(event.data.phase);
            const toolName = asString(event.data.name);
            const toolCallId = asString(event.data.toolCallId);

            if (phase === 'start' && toolName) {
              const args = event.data.args;
              if (toolCallId) {
                toolArgsByCallId.set(toolCallId, args);
              }
              yield createTelemetryEvent(timestamp, 'tool_call_start', {
                tool: toolName,
                args,
                toolCallId,
              });
            }

            if (phase === 'result' && toolName) {
              const args = toolCallId ? toolArgsByCallId.get(toolCallId) : undefined;
              const isError = asBoolean(event.data.isError);
              const result = event.data.result;
              const meta = event.data.meta;
              if (toolCallId) {
                toolArgsByCallId.delete(toolCallId);
              }
              const payload: Record<string, unknown> = {
                tool: toolName,
                args,
                toolCallId,
                result,
              };
              if (isError !== undefined) {
                payload.isError = isError;
              }
              if (meta !== undefined) {
                payload.meta = meta;
              }
              yield createTelemetryEvent(timestamp, 'tool_call_end', payload);
            }
          }

          if (event.stream === 'assistant') {
            const text = asString(event.data.text);
            const delta = asString(event.data.delta);

            if (text) {
              lastAssistantText = text;
              lastAssistantTimestamp = timestamp;
            }

            if (delta) {
              const payload: Record<string, unknown> = { content: delta };
              if (text) {
                payload.fullContent = text;
              }
              yield createTelemetryEvent(timestamp, 'llm_output_chunk', payload);
            }
          }

          if (event.stream === 'lifecycle') {
            const phase = asString(event.data.phase);
            if (phase === 'error') {
              const errorMessage = asString(event.data.error);
              runError = new OpenClawProviderError(
                'standalone',
                errorMessage ? `OpenClaw run failed: ${errorMessage}` : 'OpenClaw run failed.',
              );
              runDone = true;
            }
            if (phase === 'end') {
              runDone = true;
            }
          }

          if (runDone) {
            break;
          }
        }

        if (lastAssistantText) {
          const outputTimestamp = lastAssistantTimestamp ?? Date.now();
          yield createTelemetryEvent(outputTimestamp, 'llm_output', {
            content: lastAssistantText,
          });
        }

        try {
          await responsePromise;
        } catch (responseError) {
          // Prefer lifecycle runError over server response rejection so the more descriptive error surfaces.
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
        'standalone',
        'OpenClaw standalone execution failed.',
        { cause: normalizeError(error) },
      );
    } finally {
      client.close();
      this.client = null;
    }
  }

  public teardown(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    return Promise.resolve();
  }
}
