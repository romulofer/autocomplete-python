/**
 * The real spawn adapter for {@link PythonRunner}, backed by `child_process`.
 * This is the only file in `src/run/` that touches Node's process API.
 *
 * The wiring from a child process to a {@link RunProcessLike} lives in
 * {@link createRunProcess}, which takes the child and its timers as parameters
 * so the stop-then-kill escalation can be driven by a fake in the tests.
 */

import { spawn } from 'child_process';
import type { RunProcessLike, SpawnFn, SpawnOptions } from './runner';

/** How long a stopped process gets to exit before it is killed outright. */
const SIGKILL_GRACE_MS = 2000;

/** The subset of `ChildProcess` this adapter relies on. */
export interface ChildLike {
  readonly stdin: WritableLike | null;
  readonly stdout: StreamLike | null;
  readonly stderr: StreamLike | null;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  on(event: 'exit' | 'close', listener: (code: number | null) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  kill(signal?: NodeJS.Signals): void;
}

interface StreamLike {
  setEncoding(encoding: string): void;
  on(event: 'data', listener: (chunk: string) => void): void;
}

interface WritableLike {
  write(chunk: string): void;
  end(): void;
}

/** The two timer calls {@link createRunProcess} needs, injectable for tests. */
export interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/** Wrap a spawned child in the shape {@link PythonRunner} drives. */
export function createRunProcess(
  child: ChildLike,
  timers: Timers = realTimers
): RunProcessLike {
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  let killTimer: unknown = null;
  const clearKillTimer = (): void => {
    if (killTimer !== null) {
      timers.clear(killTimer);
      killTimer = null;
    }
  };
  child.on('exit', clearKillTimer);
  child.on('close', clearKillTimer);

  return {
    onStdout(listener) {
      child.stdout?.on('data', (chunk: string) => listener(String(chunk)));
    },
    onStderr(listener) {
      child.stderr?.on('data', (chunk: string) => listener(String(chunk)));
    },
    onExit(listener) {
      child.on('close', (code: number | null) => listener(code));
    },
    onError(listener) {
      child.on('error', (error: Error) => listener(error as NodeJS.ErrnoException));
    },
    write(text) {
      // A script that never reads stdin leaves the pipe with no reader; guard
      // so a stray keystroke in the pane cannot throw EPIPE at us.
      try {
        child.stdin?.write(text);
      } catch {
        // The script has closed its end; nothing to do.
      }
    },
    closeStdin() {
      try {
        child.stdin?.end();
      } catch {
        // Already closed.
      }
    },
    kill() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      // A script that traps SIGTERM, or one blocked in C code, would otherwise
      // keep the pane busy forever.
      killTimer = timers.set(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_MS);
    }
  };
}

export const spawnPythonProcess: SpawnFn = (options: SpawnOptions): RunProcessLike => {
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      // Belt and braces alongside `-u`: some runtimes re-enable buffering when
      // stdout is a pipe rather than a terminal.
      PYTHONUNBUFFERED: '1'
    }
  });

  return createRunProcess(child);
};
