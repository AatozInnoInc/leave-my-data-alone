// Plugin-mode adapter and middleware helpers for OpenClaw.

import type { Message, ScenarioConfig, TelemetryEvent } from '@lmda/core';
import { TelemetryCollector } from '@lmda/core';

import type {
  OpenClawAdapter,
  OpenClawEventSink,
  OpenClawProviderOptions,
} from '../provider.js';
import { OpenClawProviderError } from '../provider.js';
import { normalizeError } from '../shared/type-guards.js';

export type OpenClawMiddleware = OpenClawEventSink;

type OpenClawMiddlewareTarget = TelemetryCollector | OpenClawEventSink;

const hasHandleEvent = (target: OpenClawMiddlewareTarget): target is OpenClawEventSink =>
  typeof (target as OpenClawEventSink).handleEvent === 'function';

/**
 * Builds an OpenClaw middleware handler that records telemetry events.
 * Accepts a collector or an event sink.
 */
export const createOpenClawMiddleware = (
  target: OpenClawMiddlewareTarget,
): OpenClawMiddleware => ({
  handleEvent: (event: TelemetryEvent): void => {
    if (hasHandleEvent(target)) {
      target.handleEvent(event);
      return;
    }
    target.add(event);
  },
});

/**
 * Async FIFO bridge from push-based hooks to async iteration.
 *
 * Guarantees:
 * - Preserves push order for values accepted before close.
 * - Each push is delivered at most once; no de-duplication or retries.
 * - close() is idempotent and resolves all pending waiters with done=true.
 * - push() after close is ignored.
 *
 * Idempotency and thread safety:
 * - push() is not idempotent; callers must prevent duplicate events.
 * - Designed for a single event loop; not safe for multi-threaded access.
 * - Single-consumer usage only; concurrent iteration is not supported.
 */
class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: ((result: IteratorResult<T>) => void)[] = [];
  private closed = false;

  public push(value: T): void {
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

/**
 * Adapter that executes via a plugin runner and streams hook events.
 */
export class PluginGateway implements OpenClawAdapter {
  private readonly options: OpenClawProviderOptions;
  private activeQueue: AsyncQueue<TelemetryEvent> | null = null;
  private isExecuting = false;

  constructor(options: OpenClawProviderOptions) {
    this.options = options;
  }

  public configure(_scenario: ScenarioConfig): Promise<void> {
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
  public async *execute(messages: readonly Message[]): AsyncGenerator<TelemetryEvent> {
    if (this.isExecuting) {
      throw new OpenClawProviderError('plugin', 'Plugin gateway is already executing.');
    }

    const runner = this.options.pluginRunner;
    if (!runner) {
      throw new OpenClawProviderError(
        'plugin',
        'Plugin gateway requires a plugin runner to execute scenarios.',
      );
    }

    this.isExecuting = true;
    const queue = new AsyncQueue<TelemetryEvent>();
    this.activeQueue = queue;
    let runError: Error | null = null;

    const eventSink: OpenClawEventSink = {
      handleEvent: (event: TelemetryEvent) => {
        queue.push(event);
      },
    };

    const runPromise = Promise.resolve()
      .then(() => runner({ messages, eventSink }))
      .catch((error: unknown) => {
        runError = normalizeError(error);
      })
      .finally(() => {
        queue.close();
        this.activeQueue = null;
        this.isExecuting = false;
      });

    for await (const event of queue) {
      yield event;
    }

    await runPromise;

    // runError is set in .catch(); type checker narrows it to null after await.
    const err = runError as Error | null;
    if (err instanceof Error) {
      throw new OpenClawProviderError('plugin', 'Plugin gateway execution failed.', {
        cause: err,
      });
    }
  }

  public teardown(): Promise<void> {
    if (this.activeQueue) {
      this.activeQueue.close();
      this.activeQueue = null;
    }
    this.isExecuting = false;
    return Promise.resolve();
  }
}
