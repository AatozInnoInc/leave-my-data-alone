import { describe, expect, it, vi } from 'vitest';

import type { TelemetryEvent } from '@lmda/core';

import { OpenClawProviderError } from '../provider.js';
import { asString, isRecord } from '../shared/type-guards.js';
import { StandaloneGateway } from './gateway.js';
import type { OpenClawWebSocketClient } from './websocket.js';

type MockHandler = (...args: unknown[]) => void;

class TestWebSocketClient implements OpenClawWebSocketClient {
  public readonly url: string;
  public readyState = 0;
  public readonly sent: string[] = [];
  private readonly openHandlers: MockHandler[] = [];
  private readonly messageHandlers: ((data: string) => void)[] = [];
  private readonly closeHandlers: ((code: number, reason: string) => void)[] = [];
  private readonly errorHandlers: ((error: Error) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  public onOpen(handler: () => void): void {
    this.openHandlers.push(handler);
  }

  public onMessage(handler: (data: string) => void): void {
    this.messageHandlers.push(handler);
  }

  public onClose(handler: (code: number, reason: string) => void): void {
    this.closeHandlers.push(handler);
  }

  public onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  public send(payload: string): void {
    this.sent.push(payload);
  }

  public close(): void {
    this.readyState = 3;
    for (const handler of this.closeHandlers) {
      handler(1000, 'closed');
    }
  }

  public emitOpen(): void {
    this.readyState = 1;
    for (const handler of this.openHandlers) {
      handler();
    }
  }

  public emitMessage(payload: string): void {
    for (const handler of this.messageHandlers) {
      handler(payload);
    }
  }

  public emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }
}

let activeSocket: TestWebSocketClient | null = null;

vi.mock('./websocket.js', () => ({
  createWebSocketClient: (url: string): OpenClawWebSocketClient => {
    activeSocket = new TestWebSocketClient(url);
    return activeSocket;
  },
}));

interface SentFrame {
  readonly id: string;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

const parseSentFrame = (socket: TestWebSocketClient, index: number): SentFrame => {
  const raw = socket.sent[index];
  if (!raw) {
    throw new Error(`Missing sent frame at index ${String(index)}.`);
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Sent frame is not an object.');
  }
  const id = asString(parsed.id);
  const method = asString(parsed.method);
  const params = isRecord(parsed.params) ? parsed.params : undefined;
  if (!id || !method) {
    throw new Error('Sent frame is missing id or method.');
  }
  return {
    id,
    method,
    ...(params !== undefined && { params }),
  };
};

const getActiveSocket = (): TestWebSocketClient => {
  if (!activeSocket) {
    throw new Error('Test socket was not created.');
  }
  return activeSocket;
};

const waitFor = async (predicate: () => boolean, attempts = 10): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error('Timed out waiting for condition.');
};

const collectEvents = async (iterator: AsyncIterable<TelemetryEvent>): Promise<TelemetryEvent[]> => {
  const events: TelemetryEvent[] = [];
  for await (const event of iterator) {
    events.push(event);
  }
  return events;
};

describe('StandaloneGateway', () => {
  it('throws when no user messages are provided', async () => {
    // Arrange
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
    });

    // Act
    const iterator = gateway.execute([{ role: 'system', content: 'system-only' }]);

    // Assert
    await expect(iterator.next()).rejects.toBeInstanceOf(OpenClawProviderError);
  });

  it('streams telemetry from agent events', async () => {
    // Arrange
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [
      { role: 'system', content: 'Use tools carefully.' },
      { role: 'user', content: 'hello' },
    ] as const;

    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();

    // Act: open socket and complete connect handshake
    socket.emitOpen();
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'x' } }),
    );
    const connectFrame = parseSentFrame(socket, 0);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: connectFrame.id, ok: true, payload: { protocol: 3 } }),
    );

    await waitFor(() => socket.sent.length >= 2);
    const agentFrame = parseSentFrame(socket, 1);
    const params = agentFrame.params ?? {};
    const runId = asString(params.idempotencyKey);
    if (!runId) {
      throw new Error('Agent request did not include an idempotency key.');
    }

    socket.emitMessage(
      JSON.stringify({
        type: 'res',
        id: agentFrame.id,
        ok: true,
        payload: { status: 'accepted', runId },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 1,
          stream: 'tool',
          ts: 1,
          data: { phase: 'start', name: 'shell.exec', toolCallId: 'call-1', args: { cmd: 'ls' } },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 2,
          stream: 'tool',
          ts: 2,
          data: { phase: 'result', name: 'shell.exec', toolCallId: 'call-1', result: 'ok' },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 3,
          stream: 'assistant',
          ts: 3,
          data: { text: 'hello', delta: 'he' },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 4,
          stream: 'assistant',
          ts: 4,
          data: { text: 'hello', delta: 'llo' },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 5,
          stream: 'lifecycle',
          ts: 5,
          data: { phase: 'end' },
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'res',
        id: agentFrame.id,
        ok: true,
        payload: { status: 'ok', result: { summary: 'done' } },
      }),
    );

    const events = await eventsPromise;

    // Assert
    expect(agentFrame.method).toBe('agent');
    expect(asString(params.sessionKey)).toBe('agent:main:main');
    expect(asString(params.agentId)).toBe('main');
    expect(asString(params.extraSystemPrompt)).toContain('Use tools carefully.');

    expect(events.map((event) => event.type)).toEqual([
      'tool_call_start',
      'tool_call_end',
      'llm_output_chunk',
      'llm_output_chunk',
      'llm_output',
    ]);

    expect(events).toHaveLength(5);
    const [e0, e1, e2, e3, e4] = events;
    if (!e0 || !e1 || !e2 || !e3 || !e4) {
      throw new Error('Expected five telemetry events.');
    }
    expect(e0.payload).toMatchObject({ tool: 'shell.exec' });
    expect(e1.payload).toMatchObject({ tool: 'shell.exec' });
    expect(e2.payload).toMatchObject({ content: 'he' });
    expect(e3.payload).toMatchObject({ content: 'llo' });
    expect(e4.payload).toMatchObject({ content: 'hello' });
    expect(e4.timestamp.getTime()).toBe(4);
  });

  it('rejects when WebSocket errors before handshake completes', async () => {
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [
      { role: 'user', content: 'hi' },
    ] as const;
    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();
    socket.emitOpen();
    socket.emitError(new Error('network failure'));

    await expect(eventsPromise).rejects.toThrow(OpenClawProviderError);
  });

  it('sends connect again when connect.challenge arrives after initial connect', async () => {
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [
      { role: 'user', content: 'hello' },
    ] as const;
    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();
    socket.emitOpen();
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: {} }),
    );
    const firstConnect = parseSentFrame(socket, 0);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: firstConnect.id, ok: true, payload: { protocol: 3 } }),
    );
    await waitFor(() => socket.sent.length >= 2);
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: {} }),
    );
    await waitFor(() => socket.sent.length >= 3);
    const secondConnect = parseSentFrame(socket, 2);
    expect(secondConnect.method).toBe('connect');
    const agentFrame = parseSentFrame(socket, 1);
    const runId = asString(agentFrame.params?.idempotencyKey);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agentFrame.id, ok: true, payload: { status: 'accepted', runId } }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { runId, seq: 1, stream: 'lifecycle', ts: 1, data: { phase: 'end' } },
      }),
    );
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agentFrame.id, ok: true, payload: { status: 'ok' } }),
    );
    await eventsPromise;
  });

  it('surfaces lifecycle error phase over server response rejection', async () => {
    // Drive the StandaloneGateway by simulating the OpenClaw gateway
    // protocol frames over a fake WebSocket client (see TestWebSocketClient above).
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [{ role: 'user', content: 'hi' }] as const;
    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();
    socket.emitOpen();
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: {} }),
    );
    const connectFrame = parseSentFrame(socket, 0);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: connectFrame.id, ok: true, payload: { protocol: 3 } }),
    );
    await waitFor(() => socket.sent.length >= 2);
    const agentFrame = parseSentFrame(socket, 1);
    const runId = asString(agentFrame.params?.idempotencyKey);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agentFrame.id, ok: true, payload: { status: 'accepted', runId } }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 1,
          stream: 'lifecycle',
          ts: 1,
          data: { phase: 'error', error: 'agent crashed' },
        },
      }),
    );
    // Also emit an error response for the original request to ensure the adapter prefers the
    // lifecycle error message (more descriptive) over a generic response rejection.
    socket.emitMessage(
      JSON.stringify({
        type: 'res',
        id: agentFrame.id,
        ok: false,
        payload: undefined,
        error: { message: 'Generic gateway error' },
      }),
    );

    await expect(eventsPromise).rejects.toThrow(OpenClawProviderError);
    await expect(eventsPromise).rejects.toThrow(/OpenClaw run failed/);
  });

  it('processes multiple user messages in sequence', async () => {
    // 2 user messages should produce 2 separate agent runs.
    // We simulate those runs by emitting `agent` events with different runIds, and we assert
    // that the adapter produces one final `llm_output` event per run.
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ] as const;
    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();
    socket.emitOpen();
    // The gateway requires a `connect.challenge` before we can send the connect request.
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: {} }),
    );
    const connectFrame = parseSentFrame(socket, 0);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: connectFrame.id, ok: true, payload: { protocol: 3 } }),
    );
    await waitFor(() => socket.sent.length >= 2);

    // Run 1: the adapter sent an `agent` request. We accept it and stream one assistant event,
    // then end the run and finalize the request.
    const agent1 = parseSentFrame(socket, 1);
    const runId1 = asString(agent1.params?.idempotencyKey);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agent1.id, ok: true, payload: { status: 'accepted', runId: runId1 } }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { runId: runId1, seq: 1, stream: 'assistant', ts: 1, data: { text: 'one', delta: 'one' } },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { runId: runId1, seq: 2, stream: 'lifecycle', ts: 2, data: { phase: 'end' } },
      }),
    );
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agent1.id, ok: true, payload: { status: 'ok' } }),
    );
    await waitFor(() => socket.sent.length >= 3);

    // Run 2: repeat for the second user message.
    const agent2 = parseSentFrame(socket, 2);
    const runId2 = asString(agent2.params?.idempotencyKey);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agent2.id, ok: true, payload: { status: 'accepted', runId: runId2 } }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { runId: runId2, seq: 1, stream: 'assistant', ts: 1, data: { text: 'two', delta: 'two' } },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { runId: runId2, seq: 2, stream: 'lifecycle', ts: 2, data: { phase: 'end' } },
      }),
    );
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agent2.id, ok: true, payload: { status: 'ok' } }),
    );

    const events = await eventsPromise;
    const llmOutputs = events.filter((e) => e.type === 'llm_output');
    expect(llmOutputs).toHaveLength(2);
    const firstOutput = llmOutputs[0];
    const secondOutput = llmOutputs[1];
    if (!firstOutput || !secondOutput) {
      throw new Error('Expected two llm_output events.');
    }
    // Note: these are the mocked assistant `text` values from the `agent` events above, not an
    // echo of the input messages ("first" / "second").
    expect(firstOutput.payload).toMatchObject({ content: 'one' });
    expect(secondOutput.payload).toMatchObject({ content: 'two' });
  });

  it('teardown closes client and iterator rejects when pending', async () => {
    // teardown() should close the underlying client. If an agent request
    // is still pending, the generator should fail rather than hang waiting for a final response.
    const gateway = new StandaloneGateway({
      mode: 'standalone',
      workspaceRoot: '/tmp/lmda',
      gatewayUrl: 'ws://127.0.0.1:18789',
      agentId: 'main',
    });
    const messages = [{ role: 'user', content: 'hi' }] as const;
    const eventsPromise = collectEvents(gateway.execute(messages));
    const socket = getActiveSocket();
    socket.emitOpen();
    socket.emitMessage(
      JSON.stringify({ type: 'event', event: 'connect.challenge', payload: {} }),
    );
    const connectFrame = parseSentFrame(socket, 0);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: connectFrame.id, ok: true, payload: { protocol: 3 } }),
    );
    await waitFor(() => socket.sent.length >= 2);
    const agentFrame = parseSentFrame(socket, 1);
    const runId = asString(agentFrame.params?.idempotencyKey);
    socket.emitMessage(
      JSON.stringify({ type: 'res', id: agentFrame.id, ok: true, payload: { status: 'accepted', runId } }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: {
          runId,
          seq: 1,
          stream: 'tool',
          ts: 1,
          data: { phase: 'start', name: 'x', toolCallId: '1', args: {} },
        },
      }),
    );
    // We intentionally do NOT emit the final response frame for the agent request.
    // teardown() should close the client and reject pending requests.
    await gateway.teardown();

    await expect(eventsPromise).rejects.toThrow();
  });
});
