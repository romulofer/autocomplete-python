/**
 * The long-lived Python process and the conversation with it.
 *
 * Everything above this layer works in promises and never sees a child process.
 * The process itself, the notifier and the interpreter registry are all injected
 * so the request bookkeeping can be driven without spawning anything.
 */

import * as log from '../log';
import {
  emptyResponse,
  generateRequestId,
  LineFramer,
  parseResponseLine,
  FATAL_ERROR_ID,
  HANDSHAKE_ID,
  type DaemonFatalError,
  type DaemonHandshake,
  type DaemonRequest,
  type DaemonResponse,
  type LookupKind
} from './protocol';
import { spawnBufferedProcess, type DaemonProcess, type ProcessFactory } from './process';
import type { InterpreterRegistry } from '../interpreters/registry';
import type { Notifier } from '../host/types';

/**
 * Beyond this many in-flight requests the user is typing faster than Jedi can
 * answer. Everything queued is stale by then, so the queue is dropped rather
 * than worked through.
 */
export const MAX_PENDING_REQUESTS = 10;

/** A request unanswered after this long is assumed lost. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Responses kept for reuse while the buffer and cursor are unchanged. */
export const RESPONSE_CACHE_SIZE = 20;

interface PendingRequest {
  resolve: (response: DaemonResponse<never>) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface JediDaemonOptions {
  interpreters: InterpreterRegistry;
  notifier: Notifier;
  /** Absolute path to `python/completion.py`. */
  scriptPath: string;
  /** Idle minutes before the daemon is shut down; `0` disables the timeout. */
  idleTimeoutMinutes: () => number;
  /** Whether to surface daemon tracebacks as notifications. */
  reportProviderErrors: () => boolean;
  /** Swapped out in tests. */
  processFactory?: ProcessFactory;
  openSettings?: () => void;
}

export class JediDaemon {
  private process: DaemonProcess | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly responseCache = new Map<string, DaemonResponse<never>>();
  private readonly framer = new LineFramer();
  private readonly processFactory: ProcessFactory;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private reportedNoInterpreter = false;
  private reportedFatalError = false;

  /** Populated from the handshake; useful in bug reports and the status bar. */
  runtime: { python: string; jedi: string } | null = null;

  constructor(private readonly options: JediDaemonOptions) {
    this.processFactory = options.processFactory ?? spawnBufferedProcess;
  }

  /** @see generateRequestId */
  requestId(
    lookup: LookupKind,
    filePath: string | null,
    source: string,
    line: number,
    column: number
  ): string {
    return generateRequestId(lookup, filePath, source, line, column);
  }

  /** A previously received response for `id`, if it is still cached. */
  cachedResponse<T>(id: string): DaemonResponse<T> | null {
    const cached = this.responseCache.get(id);
    if (!cached) return null;
    // Re-parse through JSON so callers can mutate their copy freely.
    return JSON.parse(JSON.stringify(cached)) as DaemonResponse<T>;
  }

  /**
   * Send a request and resolve with the daemon's answer.
   *
   * Failures - no interpreter, a dead process, a timeout - resolve with an
   * empty result set rather than rejecting, because every caller's fallback is
   * "no suggestions".
   */
  send<T>(request: DaemonRequest): Promise<DaemonResponse<T>> {
    if (this.disposed) return Promise.resolve(emptyResponse(request.id));

    if (this.pending.size > MAX_PENDING_REQUESTS) {
      log.debug('Request queue overflowed; dropping it and restarting');
      this.resolveAllPending();
      this.restart();
    }

    const payload = `${JSON.stringify(request)}\n`;
    if (!this.deliver(payload)) {
      return Promise.resolve(emptyResponse(request.id));
    }

    this.resetIdleTimer();
    return new Promise<DaemonResponse<T>>((resolve) => {
      const timer = setTimeout(() => {
        log.warning(`Timed out waiting for Jedi (${request.lookup})`);
        this.pending.delete(request.id);
        resolve(emptyResponse(request.id) as DaemonResponse<T>);
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(request.id, {
        resolve: resolve as (response: DaemonResponse<never>) => void,
        timer
      });
    });
  }

  /**
   * Write `payload`, spawning or respawning as needed. One respawn attempt:
   * if the process dies again immediately, the request is given up on.
   */
  private deliver(payload: string): boolean {
    if (!this.ensureProcess()) return false;
    if (this.process?.write(payload)) return true;

    log.debug('Write failed; respawning the daemon once');
    this.restart();
    if (!this.ensureProcess()) return false;
    return this.process?.write(payload) ?? false;
  }

  /** Kill the daemon; the next request spawns a fresh one. */
  restart(): void {
    this.killProcess();
    this.framer.reset();
    this.runtime = null;
    this.reportedFatalError = false;
  }

  /** Forget the cached interpreter and every response. For settings changes. */
  reload(): void {
    this.options.interpreters.invalidate();
    this.responseCache.clear();
    this.reportedNoInterpreter = false;
    this.restart();
  }

  dispose(): void {
    this.disposed = true;
    this.resolveAllPending();
    this.killProcess();
    this.clearIdleTimer();
    this.responseCache.clear();
  }

  // --- process management -------------------------------------------------

  private ensureProcess(): boolean {
    if (this.process?.isAlive()) return true;

    const interpreter = this.options.interpreters.bestPath();
    if (!interpreter) {
      this.reportNoInterpreter();
      return false;
    }

    log.debug('Spawning Jedi daemon with', interpreter);
    this.framer.reset();
    this.process = this.processFactory({
      command: interpreter,
      // `-u` keeps Python from block-buffering stdout when it is a pipe, which
      // is what makes the request/response round trip feel instant.
      args: ['-u', this.options.scriptPath],
      onStdout: (chunk) => this.handleStdout(chunk),
      onStderr: (chunk) => this.handleStderr(chunk),
      onExit: (code) => {
        log.debug('Jedi daemon exited with code', code);
        this.resolveAllPending();
      },
      onSpawnError: (error) => {
        if (error.code === 'ENOENT') {
          this.reportNoInterpreter(String(error));
        } else {
          log.error('Jedi daemon failed to spawn', error);
        }
        this.killProcess();
      }
    });

    this.resetIdleTimer();
    return true;
  }

  private killProcess(): void {
    this.process?.kill();
    this.process = null;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Shut the daemon down after a spell of inactivity, so an idle editor is not
   * holding an interpreter and Jedi's caches in memory all day. The old code
   * set one unconditional 10-minute kill timer per spawn, which also killed
   * daemons that were in active use.
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer();
    const minutes = this.options.idleTimeoutMinutes();
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    this.idleTimer = setTimeout(
      () => {
        if (this.pending.size > 0) {
          this.resetIdleTimer();
          return;
        }
        log.debug('Shutting down idle Jedi daemon');
        this.killProcess();
      },
      minutes * 60 * 1000
    );
  }

  // --- protocol -----------------------------------------------------------

  private handleStdout(chunk: string): void {
    for (const line of this.framer.push(chunk)) {
      const response = parseResponseLine(line);
      if (!response) {
        // Anything a project module prints on import lands here. It is not ours
        // to interpret, and it must not take down the response stream.
        log.warning('Ignoring non-JSON output from the Jedi daemon:', line);
        continue;
      }
      this.handleResponse(response);
    }
  }

  private handleResponse(response: DaemonResponse<never>): void {
    if (response.id === HANDSHAKE_ID) {
      const handshake = response as unknown as DaemonHandshake;
      this.runtime = { python: handshake.python, jedi: handshake.jedi };
      log.debug('Jedi daemon ready', this.runtime);
      return;
    }

    if (response.id === FATAL_ERROR_ID) {
      this.reportFatalError(response as unknown as DaemonFatalError);
      return;
    }

    this.cacheResponse(response);

    const pendingRequest = this.pending.get(response.id);
    if (!pendingRequest) {
      log.debug('Received a response nobody is waiting for', response.id);
      return;
    }
    clearTimeout(pendingRequest.timer);
    this.pending.delete(response.id);
    pendingRequest.resolve(response);
  }

  private handleStderr(chunk: string): void {
    log.debug('Jedi daemon stderr:', chunk);

    if (chunk.includes("No module named 'jedi'")) {
      this.reportFatalError({
        id: FATAL_ERROR_ID,
        results: [],
        error: 'jedi-missing',
        message: 'autocomplete-python could not import Jedi.',
        detail: chunk
      });
      return;
    }

    if (!this.options.reportProviderErrors()) return;

    const fromJedi = chunk.includes('jedi');
    this.options.notifier.warning(
      fromJedi
        ? 'autocomplete-python: error raised inside Jedi'
        : 'autocomplete-python: traceback from the completion daemon',
      {
        description: fromJedi
          ? 'Report this to the Jedi issue tracker rather than to autocomplete-python. Turn off `Output Provider Errors` to stop seeing these.'
          : 'Turn off `Output Provider Errors` to stop seeing these.',
        detail: chunk,
        dismissable: true
      }
    );
  }

  private cacheResponse(response: DaemonResponse<never>): void {
    // Map preserves insertion order, so the first key is the oldest entry.
    if (this.responseCache.size >= RESPONSE_CACHE_SIZE) {
      const oldest = this.responseCache.keys().next();
      if (!oldest.done) this.responseCache.delete(oldest.value);
    }
    this.responseCache.set(response.id, response);
  }

  private resolveAllPending(): void {
    for (const [id, pendingRequest] of this.pending) {
      clearTimeout(pendingRequest.timer);
      pendingRequest.resolve(emptyResponse(id));
    }
    this.pending.clear();
  }

  // --- user-facing errors -------------------------------------------------

  private settingsButton(): Array<{ text: string; onDidClick: () => void }> {
    const openSettings = this.options.openSettings;
    return openSettings ? [{ text: 'Open settings', onDidClick: openSettings }] : [];
  }

  private reportNoInterpreter(detail?: string): void {
    if (this.reportedNoInterpreter) return;
    this.reportedNoInterpreter = true;

    log.warning('No python interpreter found', detail);
    this.options.notifier.warning(
      'autocomplete-python could not find a Python interpreter.',
      {
        description:
          'Run **Autocomplete Python: Select Interpreter**, or set `Python Executable Paths` in the package settings.',
        detail: detail ?? '',
        dismissable: true,
        buttons: this.settingsButton()
      }
    );
  }

  private reportFatalError(error: DaemonFatalError): void {
    if (this.reportedFatalError) return;
    this.reportedFatalError = true;

    const interpreter = this.options.interpreters.bestPath() ?? 'python3';
    const descriptions: Record<DaemonFatalError['error'], string> = {
      'jedi-missing': `Install it for the interpreter in use:\n\n    ${interpreter} -m pip install --upgrade "jedi>=0.19"`,
      'jedi-too-old': `autocomplete-python needs Jedi 0.19 or newer:\n\n    ${interpreter} -m pip install --upgrade "jedi>=0.19"`,
      'python-too-old':
        'autocomplete-python needs Python 3.10 or newer. Choose a newer interpreter with **Autocomplete Python: Select Interpreter**.',
      unknown: 'The completion daemon failed to start.'
    };

    log.error(error.message, error.detail);
    this.options.notifier.error(error.message, {
      description: descriptions[error.error] ?? descriptions.unknown,
      detail: error.detail,
      dismissable: true,
      buttons: this.settingsButton()
    });
  }
}
