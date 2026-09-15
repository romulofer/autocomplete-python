import { describe, it, expect } from 'bun:test';
import {
  buildRunCommand,
  describeRunCommand,
  projectRootFor,
  resolveWorkingDirectory,
  splitArguments
} from '../src/run/command';
import {
  PythonRunner,
  type RunEvent,
  type RunProcessLike,
  type SpawnOptions
} from '../src/run/runner';

describe('splitArguments', () => {
  it('splits on whitespace', () => {
    expect(splitArguments('--verbose  -n 3')).toEqual(['--verbose', '-n', '3']);
  });

  it('keeps a quoted run together and drops the quotes', () => {
    expect(splitArguments('--path "/tmp/my data" -x')).toEqual([
      '--path',
      '/tmp/my data',
      '-x'
    ]);
    expect(splitArguments("--msg 'hello world'")).toEqual([
      '--msg',
      'hello world'
    ]);
  });

  it('returns nothing for an empty setting', () => {
    expect(splitArguments('')).toEqual([]);
    expect(splitArguments('   ')).toEqual([]);
  });

  it('does not interpret shell metacharacters', () => {
    // No shell is involved, so these are literal arguments, not operators.
    expect(splitArguments('a>b;c')).toEqual(['a>b;c']);
  });
});

describe('projectRootFor', () => {
  it('finds the root containing the file', () => {
    expect(projectRootFor('/work/app/main.py', ['/work/app'])).toBe('/work/app');
  });

  it('prefers the most deeply nested matching root', () => {
    expect(
      projectRootFor('/work/app/sub/main.py', ['/work', '/work/app/sub'])
    ).toBe('/work/app/sub');
  });

  it('returns null for a file outside every root', () => {
    expect(projectRootFor('/tmp/scratch.py', ['/work/app'])).toBeNull();
    expect(projectRootFor('/work/app/main.py', [])).toBeNull();
  });

  it('does not match a root that is only a string prefix', () => {
    expect(projectRootFor('/work/apples/main.py', ['/work/app'])).toBeNull();
  });
});

describe('resolveWorkingDirectory', () => {
  it('uses the file directory in file mode', () => {
    expect(
      resolveWorkingDirectory('/work/app/sub/main.py', ['/work/app'], 'file')
    ).toBe('/work/app/sub');
  });

  it('uses the project root in project mode', () => {
    expect(
      resolveWorkingDirectory('/work/app/sub/main.py', ['/work/app'], 'project')
    ).toBe('/work/app');
  });

  it('falls back to the file directory when the file is outside the project', () => {
    expect(
      resolveWorkingDirectory('/tmp/scratch.py', ['/work/app'], 'project')
    ).toBe('/tmp');
  });
});

describe('buildRunCommand', () => {
  it('runs the file unbuffered with the given interpreter', () => {
    const command = buildRunCommand({
      interpreter: '/envs/api/bin/python3',
      filePath: '/work/app/main.py'
    });
    expect(command.command).toBe('/envs/api/bin/python3');
    // -u keeps output arriving as the script produces it.
    expect(command.args).toEqual(['-u', '/work/app/main.py']);
    expect(command.cwd).toBe('/work/app');
  });

  it('appends the script arguments after the file', () => {
    const command = buildRunCommand({
      interpreter: '/usr/bin/python3',
      filePath: '/work/app/main.py',
      scriptArguments: ['--verbose', '-n', '3']
    });
    expect(command.args).toEqual([
      '-u',
      '/work/app/main.py',
      '--verbose',
      '-n',
      '3'
    ]);
  });

  it('honours the working directory mode', () => {
    expect(
      buildRunCommand({
        interpreter: '/usr/bin/python3',
        filePath: '/work/app/sub/main.py',
        projectPaths: ['/work/app'],
        workingDirectory: 'project'
      }).cwd
    ).toBe('/work/app');
  });
});

describe('describeRunCommand', () => {
  it('shows the interpreter basename and the arguments', () => {
    expect(
      describeRunCommand({
        command: '/envs/api/bin/python3',
        args: ['-u', '/work/app/main.py'],
        cwd: '/work/app'
      })
    ).toBe('python3 -u /work/app/main.py');
  });

  it('quotes an argument containing a space', () => {
    expect(
      describeRunCommand({
        command: '/usr/bin/python3',
        args: ['-u', '/work/my app/main.py'],
        cwd: '/work'
      })
    ).toBe('python3 -u "/work/my app/main.py"');
  });
});

// --- PythonRunner ---------------------------------------------------------

interface FakeChild extends RunProcessLike {
  emitStdout(text: string): void;
  emitStderr(text: string): void;
  emitExit(code: number | null): void;
  emitError(error: NodeJS.ErrnoException): void;
  killed: boolean;
}

function harness(): {
  runner: PythonRunner;
  events: RunEvent[];
  spawns: SpawnOptions[];
  child(): FakeChild;
} {
  const events: RunEvent[] = [];
  const spawns: SpawnOptions[] = [];
  let current: FakeChild | null = null;

  const runner = new PythonRunner((options) => {
    spawns.push(options);
    const stdout: Array<(t: string) => void> = [];
    const stderr: Array<(t: string) => void> = [];
    const exit: Array<(c: number | null) => void> = [];
    const error: Array<(e: NodeJS.ErrnoException) => void> = [];

    const child: FakeChild = {
      killed: false,
      onStdout: (l) => void stdout.push(l),
      onStderr: (l) => void stderr.push(l),
      onExit: (l) => void exit.push(l),
      onError: (l) => void error.push(l),
      kill: () => {
        child.killed = true;
      },
      emitStdout: (t) => stdout.forEach((l) => l(t)),
      emitStderr: (t) => stderr.forEach((l) => l(t)),
      emitExit: (c) => exit.forEach((l) => l(c)),
      emitError: (e) => error.forEach((l) => l(e))
    };
    current = child;
    return child;
  });

  runner.onEvent((event) => events.push(event));
  return { runner, events, spawns, child: () => current as FakeChild };
}

const input = {
  interpreter: '/usr/bin/python3',
  filePath: '/work/app/main.py'
};

describe('PythonRunner', () => {
  it('reports a start, the output, and the exit', () => {
    const h = harness();
    h.runner.run(input);

    h.child().emitStdout('hello\n');
    h.child().emitStderr('a warning\n');
    h.child().emitExit(0);

    expect(h.events.map((e) => e.type)).toEqual([
      'started',
      'stdout',
      'stderr',
      'exited'
    ]);
    expect(h.events[1]).toMatchObject({ type: 'stdout', text: 'hello\n' });
    expect(h.events[3]).toMatchObject({ type: 'exited', code: 0 });
  });

  it('tracks whether a script is running', () => {
    const h = harness();
    expect(h.runner.isRunning).toBe(false);

    h.runner.run(input);
    expect(h.runner.isRunning).toBe(true);

    h.child().emitExit(0);
    expect(h.runner.isRunning).toBe(false);
  });

  it('passes the built command through to the spawn function', () => {
    const h = harness();
    h.runner.run({ ...input, scriptArguments: ['-v'] });

    expect(h.spawns[0]).toEqual({
      command: '/usr/bin/python3',
      args: ['-u', '/work/app/main.py', '-v'],
      cwd: '/work/app'
    });
  });

  it('reports a non-zero exit code', () => {
    const h = harness();
    h.runner.run(input);
    h.child().emitExit(1);
    expect(h.events.at(-1)).toMatchObject({ type: 'exited', code: 1 });
  });

  it('reports a stop as a null exit code rather than a crash', () => {
    const h = harness();
    h.runner.run(input);
    h.runner.stop();
    expect(h.child().killed).toBe(true);

    h.child().emitExit(0);
    expect(h.events.at(-1)).toMatchObject({ type: 'exited', code: null });
  });

  it('stops a running script before starting another', () => {
    const h = harness();
    h.runner.run(input);
    const first = h.child();

    h.runner.run(input);
    expect(first.killed).toBe(true);
    expect(h.spawns).toHaveLength(2);
  });

  it('explains a missing interpreter', () => {
    const h = harness();
    h.runner.run(input);

    const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    h.child().emitError(error);

    const failure = h.events.at(-1);
    expect(failure?.type).toBe('failed');
    expect((failure as { message: string }).message).toContain(
      'Select Interpreter'
    );
    expect(h.runner.isRunning).toBe(false);
  });

  it('reports any other spawn error', () => {
    const h = harness();
    h.runner.run(input);

    const error = new Error('EACCES') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    h.child().emitError(error);

    expect(h.events.at(-1)).toMatchObject({ type: 'failed' });
  });

  it('reports a spawn function that throws instead of propagating', () => {
    const runner = new PythonRunner(() => {
      throw new Error('no processes allowed');
    });
    const events: RunEvent[] = [];
    runner.onEvent((event) => events.push(event));

    expect(() => runner.run(input)).not.toThrow();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('failed');
  });

  it('stops the child when disposed', () => {
    const h = harness();
    h.runner.run(input);
    h.runner.dispose();
    expect(h.child().killed).toBe(true);
  });

  it('ignores a stop when nothing is running', () => {
    const h = harness();
    expect(() => h.runner.stop()).not.toThrow();
    expect(h.events).toHaveLength(0);
  });

  it('lets a listener unsubscribe', () => {
    const h = harness();
    const seen: RunEvent[] = [];
    const unsubscribe = h.runner.onEvent((event) => seen.push(event));

    h.runner.run(input);
    expect(seen).toHaveLength(1);

    unsubscribe();
    h.child().emitExit(0);
    expect(seen).toHaveLength(1);
  });
});
