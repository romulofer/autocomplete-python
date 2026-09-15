/**
 * Running a Python file and reporting what it produced.
 *
 * The spawn function is injected, so the lifecycle - start, stream, stop, exit -
 * is driven by a fake process in the tests.
 */

import { buildRunCommand, describeRunCommand, type RunCommandInput } from './command';

export interface RunProcessLike {
  onStdout(listener: (chunk: string) => void): void;
  onStderr(listener: (chunk: string) => void): void;
  /** `code` is `null` when the process was terminated by a signal. */
  onExit(listener: (code: number | null) => void): void;
  onError(listener: (error: NodeJS.ErrnoException) => void): void;
  kill(): void;
}

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
}

export type SpawnFn = (options: SpawnOptions) => RunProcessLike;

export type RunEvent =
  | { type: 'started'; description: string; cwd: string }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'exited'; code: number | null; durationMs: number }
  | { type: 'failed'; message: string };

export type RunListener = (event: RunEvent) => void;

/**
 * Owns at most one child process at a time. Starting a run while one is already
 * going stops the old one first: two scripts writing into one output pane is
 * never what the user meant.
 */
export class PythonRunner {
  private child: RunProcessLike | null = null;
  private startedAt = 0;
  private listeners = new Set<RunListener>();
  /** Set while stopping, so the exit that follows is reported as a stop. */
  private stopping = false;

  constructor(private readonly spawnFn: SpawnFn) {}

  onEvent(listener: RunListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isRunning(): boolean {
    return this.child !== null;
  }

  run(input: RunCommandInput): void {
    if (this.child) this.stop();

    const runCommand = buildRunCommand(input);
    this.startedAt = Date.now();
    this.stopping = false;

    let child: RunProcessLike;
    try {
      child = this.spawnFn(runCommand);
    } catch (err) {
      this.emit({ type: 'failed', message: String(err) });
      return;
    }
    this.child = child;

    this.emit({
      type: 'started',
      description: describeRunCommand(runCommand),
      cwd: runCommand.cwd
    });

    child.onStdout((text) => this.emit({ type: 'stdout', text }));
    child.onStderr((text) => this.emit({ type: 'stderr', text }));

    child.onError((error) => {
      this.child = null;
      const message =
        error.code === 'ENOENT'
          ? `Could not run ${runCommand.command}. Choose another interpreter with "Select Interpreter".`
          : `Failed to start the script: ${error.message}`;
      this.emit({ type: 'failed', message });
    });

    child.onExit((code) => {
      // A killed process reports a null code; report it as the stop it was.
      const reported = this.stopping ? null : code;
      this.child = null;
      this.stopping = false;
      this.emit({
        type: 'exited',
        code: reported,
        durationMs: Date.now() - this.startedAt
      });
    });
  }

  stop(): void {
    if (!this.child) return;
    this.stopping = true;
    this.child.kill();
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  private emit(event: RunEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
