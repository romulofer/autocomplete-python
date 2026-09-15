/**
 * The real spawn adapter for {@link PythonRunner}, backed by `child_process`.
 * This is the only file in `src/run/` that touches Node's process API.
 */

import { spawn } from 'child_process';
import type { RunProcessLike, SpawnFn, SpawnOptions } from './runner';

/** How long a stopped process gets to exit before it is killed outright. */
const SIGKILL_GRACE_MS = 2000;

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

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  let killTimer: ReturnType<typeof setTimeout> | null = null;
  const clearKillTimer = (): void => {
    if (killTimer) {
      clearTimeout(killTimer);
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
    kill() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      // A script that traps SIGTERM, or one blocked in C code, would otherwise
      // keep the pane busy forever.
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_MS);
    }
  };
};
