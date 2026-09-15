/**
 * The child-process seam.
 *
 * {@link JediDaemon} talks to this interface rather than to Pulsar's
 * `BufferedProcess`, so the request/response bookkeeping can be driven by a
 * fake process in the tests.
 */

import { BufferedProcess } from 'atom';

export interface DaemonProcessHandlers {
  onStdout(chunk: string): void;
  onStderr(chunk: string): void;
  onExit(code: number | null): void;
  /** Spawn failures, most importantly `ENOENT` for a missing interpreter. */
  onSpawnError(error: NodeJS.ErrnoException): void;
}

export interface DaemonProcessOptions extends DaemonProcessHandlers {
  command: string;
  args: string[];
}

export interface DaemonProcess {
  /** `false` when the pipe is gone; the caller decides whether to respawn. */
  write(data: string): boolean;
  kill(): void;
  isAlive(): boolean;
}

export type ProcessFactory = (options: DaemonProcessOptions) => DaemonProcess;

/** The real factory, backed by Pulsar's `BufferedProcess`. */
export const spawnBufferedProcess: ProcessFactory = (options) => {
  const process = new BufferedProcess({
    command: options.command,
    args: options.args,
    stdout: options.onStdout,
    stderr: options.onStderr,
    exit: options.onExit
  });

  process.onWillThrowError(({ error, handle }) => {
    options.onSpawnError(error as NodeJS.ErrnoException);
    // Always handled: an unhandled spawn error surfaces to the user as an
    // editor-level crash dialog, which tells them nothing useful.
    handle();
  });

  // A closed stdin arrives here rather than as an uncaught exception.
  process.process?.stdin?.on('error', () => {
    /* reported through the failed write instead */
  });

  return {
    write(data: string): boolean {
      const stdin = process.process?.stdin;
      if (!stdin || stdin.destroyed) return false;
      try {
        stdin.write(data);
        return true;
      } catch {
        return false;
      }
    },

    kill(): void {
      try {
        process.kill();
      } catch {
        /* already gone */
      }
    },

    isAlive(): boolean {
      const child = process.process;
      if (!child) return false;
      return child.exitCode === null && child.signalCode === null;
    }
  };
};
