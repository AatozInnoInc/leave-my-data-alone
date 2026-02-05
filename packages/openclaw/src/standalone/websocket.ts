// WebSocket helpers for standalone gateway connections.

import { WebSocket } from 'ws';

import { isRecord, normalizeError } from '../shared/type-guards.js';

export interface OpenClawWebSocketClient {
  readonly url: string;
  readonly readyState: number;
  onOpen(handler: () => void): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onError(handler: (error: Error) => void): void;
  send(payload: string): void;
  close(code?: number, reason?: string): void;
}

export class OpenClawWebSocketError extends Error {
  public readonly url: string;

  constructor(url: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OpenClawWebSocketError';
    this.url = url;
  }
}

export const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;

const stringifySocketData = (data: unknown): string => {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8');
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '';
    }
    const buffers = data.filter((entry): entry is Buffer => Buffer.isBuffer(entry));
    if (buffers.length === data.length) {
      return Buffer.concat(buffers).toString('utf8');
    }
    // Chunked message with non-Buffer entries; avoid producing "[object Object]".
    console.warn('[OpenClaw] WebSocket message array contained non-Buffer entries; treating as unexpected.');
    return String(data);
  }

  if (isRecord(data) && typeof data.toString === 'function') {
    return data.toString();
  }

  return String(data);
};

class OpenClawWsClient implements OpenClawWebSocketClient {
  public readonly url: string;
  private readonly socket: WebSocket;

  constructor(url: string, socket: WebSocket) {
    this.url = url;
    this.socket = socket;
  }

  public get readyState(): number {
    return this.socket.readyState;
  }

  public onOpen(handler: () => void): void {
    this.socket.on('open', handler);
  }

  public onMessage(handler: (data: string) => void): void {
    this.socket.on('message', (data: unknown) => {
      handler(stringifySocketData(data));
    });
  }

  public onClose(handler: (code: number, reason: string) => void): void {
    this.socket.on('close', (code: number, reason: unknown) => {
      handler(code, stringifySocketData(reason));
    });
  }

  public onError(handler: (error: Error) => void): void {
    this.socket.on('error', (error: unknown) => {
      handler(normalizeError(error));
    });
  }

  public send(payload: string): void {
    this.socket.send(payload);
  }

  public close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }
}

/**
 * Creates a WebSocket client for the OpenClaw gateway.
 */
export const createWebSocketClient = (url: string): OpenClawWebSocketClient => {
  const normalizedUrl = url.trim();
  if (normalizedUrl.length === 0) {
    throw new OpenClawWebSocketError(url, 'Gateway URL must be a non-empty value.');
  }

  try {
    const socket = new WebSocket(normalizedUrl, { maxPayload: MAX_PAYLOAD_BYTES });
    return new OpenClawWsClient(normalizedUrl, socket);
  } catch (error) {
    throw new OpenClawWebSocketError(
      normalizedUrl,
      'Failed to create a WebSocket connection for the OpenClaw gateway.',
      { cause: normalizeError(error) },
    );
  }
};
