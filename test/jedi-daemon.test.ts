import { describe, it, expect } from 'bun:test';
import { JediDaemon } from '../src/daemon/jedi-daemon';
import { InterpreterRegistry } from '../src/interpreters/registry';
import { FATAL_ERROR_ID, HANDSHAKE_ID } from '../src/daemon/protocol';
import type { DaemonProcess, DaemonProcessOptions } from '../src/daemon/process';
import type { DaemonRequest } from '../src/daemon/protocol';
import type { Notifier, NotificationOptions } from '../src/host/types';
import { fakeHost } from './helpers/fake-host';

interface Harness {
  daemon: JediDaemon;
  /** Every payload written to the daemon's stdin. */
  writes: string[];
  /** Feed a chunk as if it came from the daemon's stdout. */
  emitStdout(chunk: string): void;
  emitStderr(chunk: string): void;
  emitSpawnError(error: NodeJS.ErrnoException): void;
  notifications: Array<{ level: string; message: string }>;
  spawnCount(): number;
  killProcess(): void;
}

function harness(
  options: { interpreter?: string | null; reportProviderErrors?: boolean } = {}
): Harness {
  const interpreter =
    options.interpreter === undefined ? '/usr/bin/python3' : options.interpreter;

  const host = fakeHost(
    interpreter ? { executables: [interpreter] } : {},
    { pathEntries: interpreter ? ['/usr/bin'] : [] }
  );
  const interpreters = new InterpreterRegistry(host, () => ({}));

  const writes: string[] = [];
  const notifications: Array<{ level: string; message: string }> = [];
  let handlers: DaemonProcessOptions | null = null;
  let alive = true;
  let spawns = 0;

  const notifier: Notifier = {
    info: (message: string, _options?: NotificationOptions) =>
      void notifications.push({ level: 'info', message }),
    success: (message: string) =>
      void notifications.push({ level: 'success', message }),
    warning: (message: string) =>
      void notifications.push({ level: 'warning', message }),
    error: (message: string) =>
      void notifications.push({ level: 'error', message })
  };

  const daemon = new JediDaemon({
    interpreters,
    notifier,
    scriptPath: '/pkg/python/completion.py',
    idleTimeoutMinutes: () => 0,
    reportProviderErrors: () => options.reportProviderErrors ?? false,
    processFactory: (processOptions): DaemonProcess => {
      handlers = processOptions;
      alive = true;
      spawns += 1;
      return {
        write: (data: string) => {
          if (!alive) return false;
          writes.push(data);
          return true;
        },
        kill: () => {
          alive = false;
        },
        isAlive: () => alive
      };
    }
  });

  return {
    daemon,
    writes,
    notifications,
    emitStdout: (chunk) => handlers?.onStdout(chunk),
    emitStderr: (chunk) => handlers?.onStderr(chunk),
    emitSpawnError: (error) => handlers?.onSpawnError(error),
    spawnCount: () => spawns,
    killProcess: () => {
      alive = false;
    }
  };
}

function request(overrides: Partial<DaemonRequest> = {}): DaemonRequest {
  return {
    id: 'req-1',
    lookup: 'completions',
    path: '/work/app.py',
    source: 'import os',
    line: 0,
    column: 9,
    config: {
      extraPaths: [],
      useSnippets: 'none',
      caseInsensitiveCompletion: true,
      showDescriptions: true,
      fuzzyMatcher: true
    },
    ...overrides
  };
}

describe('JediDaemon.send', () => {
  it('writes one newline-terminated JSON line per request', async () => {
    const h = harness();
    const pending = h.daemon.send(request());

    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]!.endsWith('\n')).toBe(true);
    expect(JSON.parse(h.writes[0]!).id).toBe('req-1');

    h.emitStdout('{"id":"req-1","results":[{"text":"os"}]}\n');
    expect((await pending).results).toEqual([{ text: 'os' }]);
  });

  it('resolves the matching request and leaves others pending', async () => {
    const h = harness();
    const first = h.daemon.send(request({ id: 'a' }));
    const second = h.daemon.send(request({ id: 'b' }));

    h.emitStdout('{"id":"b","results":["second"]}\n');
    expect((await second).results).toEqual(['second']);

    h.emitStdout('{"id":"a","results":["first"]}\n');
    expect((await first).results).toEqual(['first']);
  });

  it('ignores output that is not JSON without losing the real response', async () => {
    const h = harness();
    const pending = h.daemon.send(request());

    h.emitStdout('Welcome to SomeLib 2.0\n');
    h.emitStdout('{"id":"req-1","results":["ok"]}\n');
    expect((await pending).results).toEqual(['ok']);
  });

  it('reassembles a response split across chunks', async () => {
    const h = harness();
    const pending = h.daemon.send(request());

    h.emitStdout('{"id":"req-1",');
    h.emitStdout('"results":["ok"]}');
    h.emitStdout('\n');
    expect((await pending).results).toEqual(['ok']);
  });

  it('resolves empty when there is no interpreter', async () => {
    const h = harness({ interpreter: null });
    expect((await h.daemon.send(request())).results).toEqual([]);
    expect(h.notifications.some((entry) => entry.level === 'warning')).toBe(true);
  });

  it('warns about a missing interpreter only once', async () => {
    const h = harness({ interpreter: null });
    await h.daemon.send(request({ id: 'a' }));
    await h.daemon.send(request({ id: 'b' }));
    expect(h.notifications).toHaveLength(1);
  });

  it('respawns once when the process died between requests', async () => {
    const h = harness();

    const first = h.daemon.send(request({ id: 'a' }));
    h.emitStdout('{"id":"a","results":["before"]}\n');
    expect((await first).results).toEqual(['before']);
    expect(h.spawnCount()).toBe(1);

    h.killProcess();
    const second = h.daemon.send(request({ id: 'b' }));
    expect(h.spawnCount()).toBe(2);

    h.emitStdout('{"id":"b","results":["after respawn"]}\n');
    expect((await second).results).toEqual(['after respawn']);
  });

  it('resolves everything pending when the daemon is disposed', async () => {
    const h = harness();
    const pending = h.daemon.send(request());
    h.daemon.dispose();
    expect((await pending).results).toEqual([]);
  });

  it('resolves empty once disposed', async () => {
    const h = harness();
    h.daemon.dispose();
    expect((await h.daemon.send(request())).results).toEqual([]);
  });
});

describe('JediDaemon caching', () => {
  it('caches responses by request id', async () => {
    const h = harness();
    const pending = h.daemon.send(request());
    h.emitStdout('{"id":"req-1","results":["cached"]}\n');
    await pending;

    expect(h.daemon.cachedResponse('req-1')?.results).toEqual(['cached']);
    expect(h.daemon.cachedResponse('never-seen')).toBeNull();
  });

  it('hands out a copy so callers cannot corrupt the cache', async () => {
    const h = harness();
    const pending = h.daemon.send(request());
    h.emitStdout('{"id":"req-1","results":[{"text":"os"}]}\n');
    await pending;

    const first = h.daemon.cachedResponse<{ text: string }>('req-1');
    first!.results[0]!.text = 'mutated';
    expect(h.daemon.cachedResponse<{ text: string }>('req-1')!.results[0]!.text).toBe(
      'os'
    );
  });

  it('drops the cache on reload', async () => {
    const h = harness();
    const pending = h.daemon.send(request());
    h.emitStdout('{"id":"req-1","results":["cached"]}\n');
    await pending;

    h.daemon.reload();
    expect(h.daemon.cachedResponse('req-1')).toBeNull();
  });
});

describe('JediDaemon handshake and errors', () => {
  it('records the runtime reported at startup', () => {
    const h = harness();
    void h.daemon.send(request());
    h.emitStdout(
      `{"id":"${HANDSHAKE_ID}","results":[],"python":"3.12.4","jedi":"0.19.2"}\n`
    );
    expect(h.daemon.runtime).toEqual({ python: '3.12.4', jedi: '0.19.2' });
  });

  it('clears the runtime on restart', () => {
    const h = harness();
    void h.daemon.send(request());
    h.emitStdout(
      `{"id":"${HANDSHAKE_ID}","results":[],"python":"3.12.4","jedi":"0.19.2"}\n`
    );
    h.daemon.restart();
    expect(h.daemon.runtime).toBeNull();
  });

  it('reports a fatal error from the daemon as an error notification', () => {
    const h = harness();
    void h.daemon.send(request());
    h.emitStdout(
      `{"id":"${FATAL_ERROR_ID}","results":[],"error":"jedi-missing","message":"could not import Jedi","detail":"traceback"}\n`
    );

    const errors = h.notifications.filter((entry) => entry.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('could not import Jedi');
  });

  it('recognises a missing Jedi reported on stderr', () => {
    const h = harness();
    void h.daemon.send(request());
    h.emitStderr("ModuleNotFoundError: No module named 'jedi'\n");
    expect(h.notifications.some((entry) => entry.level === 'error')).toBe(true);
  });

  it('stays quiet about tracebacks unless asked', () => {
    const quiet = harness();
    void quiet.daemon.send(request());
    quiet.emitStderr('Traceback (most recent call last): ...\n');
    expect(quiet.notifications).toHaveLength(0);

    const loud = harness({ reportProviderErrors: true });
    void loud.daemon.send(request());
    loud.emitStderr('Traceback (most recent call last): ...\n');
    expect(loud.notifications.some((entry) => entry.level === 'warning')).toBe(
      true
    );
  });

  it('warns about a spawn failure', () => {
    const h = harness();
    void h.daemon.send(request());

    const error = new Error('spawn python ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    h.emitSpawnError(error);

    expect(h.notifications.some((entry) => entry.level === 'warning')).toBe(true);
  });
});
