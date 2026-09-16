import { describe, it, expect } from 'bun:test';
import { createRunProcess, type ChildLike, type Timers } from '../src/run/spawn';

/** A stream that records its encoding and replays `data` to its listeners. */
class FakeStream {
  encoding: string | null = null;
  private listeners: Array<(chunk: string) => void> = [];

  setEncoding(encoding: string): void {
    this.encoding = encoding;
  }

  on(_event: 'data', listener: (chunk: string) => void): void {
    this.listeners.push(listener);
  }

  emit(chunk: string): void {
    for (const listener of this.listeners) listener(chunk);
  }
}

/** A child process whose lifecycle the test drives by hand. */
class FakeChild implements ChildLike {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  readonly signals: NodeJS.Signals[] = [];

  private handlers: Record<string, Array<(arg: unknown) => void>> = {};

  on(event: string, listener: (arg: never) => void): void {
    (this.handlers[event] ??= []).push(listener as (arg: unknown) => void);
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    this.signals.push(signal);
  }

  emit(event: string, arg?: unknown): void {
    for (const handler of this.handlers[event] ?? []) handler(arg);
  }
}

/** Timers that capture the scheduled callback so the test can fire it. */
function fakeTimers(): Timers & { fire(): void; cleared: boolean } {
  let scheduled: (() => void) | null = null;
  let cleared = false;
  return {
    set(callback) {
      scheduled = callback;
      return 1;
    },
    clear() {
      cleared = true;
      scheduled = null;
    },
    fire() {
      scheduled?.();
    },
    get cleared() {
      return cleared;
    }
  };
}

describe('createRunProcess', () => {
  it('sets both streams to utf8 so chunks arrive as strings', () => {
    const child = new FakeChild();
    createRunProcess(child, fakeTimers());
    expect(child.stdout.encoding).toBe('utf8');
    expect(child.stderr.encoding).toBe('utf8');
  });

  it('forwards stdout and stderr chunks', () => {
    const child = new FakeChild();
    const proc = createRunProcess(child, fakeTimers());

    const out: string[] = [];
    const err: string[] = [];
    proc.onStdout((chunk) => out.push(chunk));
    proc.onStderr((chunk) => err.push(chunk));

    child.stdout.emit('hello');
    child.stderr.emit('oops');

    expect(out).toEqual(['hello']);
    expect(err).toEqual(['oops']);
  });

  it('reports the exit through the close event', () => {
    const child = new FakeChild();
    const proc = createRunProcess(child, fakeTimers());

    const codes: (number | null)[] = [];
    proc.onExit((code) => codes.push(code));
    child.emit('close', 0);

    expect(codes).toEqual([0]);
  });

  it('forwards a spawn error', () => {
    const child = new FakeChild();
    const proc = createRunProcess(child, fakeTimers());

    const errors: Error[] = [];
    proc.onError((error) => errors.push(error));
    const failure = new Error('spawn ENOENT');
    child.emit('error', failure);

    expect(errors).toEqual([failure]);
  });

  it('escalates to SIGKILL when the child ignores SIGTERM', () => {
    const child = new FakeChild();
    const timers = fakeTimers();
    const proc = createRunProcess(child, timers);

    proc.kill();
    expect(child.signals).toEqual(['SIGTERM']);

    // The grace period elapses with the child still alive.
    timers.fire();
    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('does not escalate when the child exits within the grace period', () => {
    const child = new FakeChild();
    const timers = fakeTimers();
    const proc = createRunProcess(child, timers);

    proc.kill();
    // The child exits before the timer fires; the close handler clears it.
    child.exitCode = 0;
    child.emit('close', 0);
    expect(timers.cleared).toBe(true);

    // Firing a stale timer must not send a second signal.
    timers.fire();
    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('does not escalate when the child died just as the timer fired', () => {
    const child = new FakeChild();
    const timers = fakeTimers();
    const proc = createRunProcess(child, timers);

    proc.kill();
    child.signalCode = 'SIGTERM';
    timers.fire();

    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('ignores a kill when the child has already exited', () => {
    const child = new FakeChild();
    child.exitCode = 0;
    const proc = createRunProcess(child, fakeTimers());

    proc.kill();
    expect(child.signals).toEqual([]);
  });
});
