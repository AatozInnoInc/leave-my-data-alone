import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWebSocketClient, MAX_PAYLOAD_BYTES, OpenClawWebSocketError } from './websocket.js';

type MockSocketHandlers = Record<string, Array<(...args: unknown[]) => void>>;

type MockWebSocket = {
  readonly url: string;
  readonly options?: unknown;
  readyState: number;
  readonly handlers: MockSocketHandlers;
  readonly send: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
};

let lastSocket: MockWebSocket | null = null;

vi.mock('ws', () => {
  class WebSocket {
    public static OPEN = 1;
    public readonly url: string;
    public readonly options?: unknown;
    public readyState = WebSocket.OPEN;
    public readonly handlers: MockSocketHandlers = {};
    public send = vi.fn();
    public close = vi.fn();

    constructor(url: string, options?: unknown) {
      this.url = url;
      this.options = options;
      lastSocket = this as unknown as MockWebSocket;
    }

    public on(event: string, handler: (...args: unknown[]) => void): void {
      const existing = this.handlers[event] ?? [];
      existing.push(handler);
      this.handlers[event] = existing;
    }

    public emit(event: string, ...args: unknown[]): void {
      const handlers = this.handlers[event] ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  return { WebSocket };
});

const getLastSocket = (): MockWebSocket => {
  if (!lastSocket) {
    throw new Error('Mock WebSocket was not created.');
  }
  return lastSocket;
};

describe('createWebSocketClient', () => {
  beforeEach(() => {
    lastSocket = null;
  });

  it('wraps WebSocket events and messages', () => {
    // Arrange
    const client = createWebSocketClient('ws://example.com');
    const socket = getLastSocket();
    const messageHandler = vi.fn();
    const openHandler = vi.fn();
    const closeHandler = vi.fn();
    const errorHandler = vi.fn();

    // Act
    client.onMessage(messageHandler);
    client.onOpen(openHandler);
    client.onClose(closeHandler);
    client.onError(errorHandler);

    socket.emit('open');
    socket.emit('message', Buffer.from('hello'));
    socket.emit('close', 1000, Buffer.from('bye'));
    socket.emit('error', new Error('boom'));

    // Assert
    expect(openHandler).toHaveBeenCalledOnce();
    expect(messageHandler).toHaveBeenCalledWith('hello');
    expect(closeHandler).toHaveBeenCalledWith(1000, 'bye');
    expect(errorHandler).toHaveBeenCalled();
  });

  it('rejects empty gateway urls', () => {
    // Arrange
    const url = '   ';

    // Act
    const action = (): void => {
      createWebSocketClient(url);
    };

    // Assert
    expect(action).toThrow(OpenClawWebSocketError);
  });

  it('passes maxPayload to WebSocket constructor', () => {
    createWebSocketClient('ws://example.com');
    const socket = getLastSocket();
    expect(socket.options).toMatchObject({ maxPayload: MAX_PAYLOAD_BYTES });
  });

  it('stringifies ArrayBuffer message as utf8', () => {
    const client = createWebSocketClient('ws://example.com');
    const socket = getLastSocket();
    const messageHandler = vi.fn();
    client.onMessage(messageHandler);
    const buf = new ArrayBuffer(4);
    new Uint8Array(buf).set([0x68, 0x69, 0x21, 0x21]); // "hi!!"
    socket.emit('message', buf);
    expect(messageHandler).toHaveBeenCalledWith('hi!!');
  });

  it('stringifies ArrayBuffer.isView (TypedArray) message as utf8', () => {
    const client = createWebSocketClient('ws://example.com');
    const socket = getLastSocket();
    const messageHandler = vi.fn();
    client.onMessage(messageHandler);
    const view = new Uint8Array([0x6f, 0x6b]); // "ok"
    socket.emit('message', view);
    expect(messageHandler).toHaveBeenCalledWith('ok');
  });
});
