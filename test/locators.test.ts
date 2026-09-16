import { describe, it, expect } from 'bun:test';
import {
  condaInterpreters,
  configuredInterpreters,
  discoverInterpreters,
  environmentNameFor,
  executablesIn,
  interpreterRank,
  pipenvInterpreters,
  poetryInterpreters,
  pyenvInterpreters,
  selectedInterpreter,
  shebangInterpreterPath,
  shebangInterpreters,
  shellEnvironmentInterpreters,
  SOURCE_LABELS,
  virtualenvwrapperInterpreters,
  workspaceInterpreters,
  type InterpreterSource
} from '../src/interpreters/locators';
import { fakeHost } from './helpers/fake-host';

const paths = (entries: { filePath: string }[]): string[] =>
  entries.map((entry) => entry.filePath);

describe('interpreterRank', () => {
  it('prefers python3, then a versioned python3, then bare python', () => {
    expect(interpreterRank('/usr/bin/python3')).toBeLessThan(
      interpreterRank('/usr/bin/python3.12')
    );
    expect(interpreterRank('/usr/bin/python3.12')).toBeLessThan(
      interpreterRank('/usr/bin/python')
    );
  });

  it('ignores a .exe suffix', () => {
    expect(interpreterRank('C:\\Python\\python3.exe')).toBe(
      interpreterRank('/usr/bin/python3')
    );
  });
});

describe('executablesIn', () => {
  it('returns python executables best candidate first', () => {
    const host = fakeHost({
      executables: [
        '/usr/bin/python',
        '/usr/bin/python3',
        '/usr/bin/python3.12'
      ]
    });
    expect(executablesIn(host, '/usr/bin')).toEqual([
      '/usr/bin/python3',
      '/usr/bin/python3.12',
      '/usr/bin/python'
    ]);
  });

  // Upstream issue #251: a directory called `python` on PATH used to be
  // returned as the interpreter, and the editor then hung on a process that
  // never started.
  it('skips a directory named python', () => {
    const host = fakeHost({
      dirs: ['/opt/tools/python'],
      executables: ['/opt/tools/python3']
    });
    expect(executablesIn(host, '/opt/tools')).toEqual(['/opt/tools/python3']);
  });

  it('skips a non-executable file named python', () => {
    const host = fakeHost({ files: { '/opt/tools/python': 'not a binary' } });
    expect(executablesIn(host, '/opt/tools')).toEqual([]);
  });

  it('ignores unrelated names and unreadable directories', () => {
    const host = fakeHost({ executables: ['/usr/bin/pythonista', '/usr/bin/pip'] });
    expect(executablesIn(host, '/usr/bin')).toEqual([]);
    expect(executablesIn(host, '/does/not/exist')).toEqual([]);
    expect(executablesIn(host, '')).toEqual([]);
  });

  it('matches python.exe only on Windows', () => {
    const tree = { executables: ['C:\\Python312\\python.exe'] };
    expect(
      executablesIn(fakeHost(tree, { platform: 'win32' }), 'C:\\Python312')
    ).toEqual(['C:\\Python312\\python.exe']);
    expect(executablesIn(fakeHost(tree), 'C:\\Python312')).toEqual([]);
  });
});

describe('environmentNameFor', () => {
  it('names the environment a bin/python belongs to', () => {
    const host = fakeHost({
      executables: ['/work/app/.venv/bin/python3'],
      files: { '/work/app/.venv/pyvenv.cfg': '' }
    });
    expect(environmentNameFor(host, '/work/app/.venv/bin/python3')).toBe('.venv');
  });

  it('returns null for an interpreter in a system directory', () => {
    const host = fakeHost({ executables: ['/usr/bin/python3'] });
    expect(environmentNameFor(host, '/usr/bin/python3')).toBeNull();
  });
});

describe('selectedInterpreter', () => {
  it('wins when it points at a real executable', () => {
    const host = fakeHost({ executables: ['/opt/py/bin/python3'] });
    expect(paths(selectedInterpreter(host, '/opt/py/bin/python3'))).toEqual([
      '/opt/py/bin/python3'
    ]);
  });

  it('is ignored when blank or stale', () => {
    const host = fakeHost({ executables: ['/opt/py/bin/python3'] });
    expect(selectedInterpreter(host, '')).toEqual([]);
    expect(selectedInterpreter(host, '   ')).toEqual([]);
    expect(selectedInterpreter(host, '/deleted/python3')).toEqual([]);
  });
});

describe('configuredInterpreters', () => {
  it('keeps the configured order and expands $PROJECT', () => {
    const host = fakeHost(
      {
        executables: ['/work/app/.venv/bin/python3', '/usr/bin/python3']
      },
      {},
      ['/work/app']
    );
    expect(
      paths(
        configuredInterpreters(host, [
          '$PROJECT/.venv/bin/python3',
          '/usr/bin/python3'
        ])
      )
    ).toEqual(['/work/app/.venv/bin/python3', '/usr/bin/python3']);
  });

  it('drops entries that do not exist', () => {
    const host = fakeHost({ executables: ['/usr/bin/python3'] });
    expect(
      paths(configuredInterpreters(host, ['/nope/python3', '/usr/bin/python3']))
    ).toEqual(['/usr/bin/python3']);
  });
});

describe('shellEnvironmentInterpreters', () => {
  it('finds the activated virtualenv', () => {
    const host = fakeHost(
      { executables: ['/envs/api/bin/python3'] },
      { vars: { VIRTUAL_ENV: '/envs/api' } }
    );
    expect(paths(shellEnvironmentInterpreters(host))).toEqual([
      '/envs/api/bin/python3'
    ]);
  });

  it('finds the activated conda environment', () => {
    const host = fakeHost(
      { executables: ['/opt/conda/envs/ml/bin/python3'] },
      { vars: { CONDA_PREFIX: '/opt/conda/envs/ml' } }
    );
    expect(paths(shellEnvironmentInterpreters(host))).toEqual([
      '/opt/conda/envs/ml/bin/python3'
    ]);
  });
});

describe('workspaceInterpreters', () => {
  it('prefers .venv over other conventional names', () => {
    const host = fakeHost(
      {
        executables: [
          '/work/app/venv/bin/python3',
          '/work/app/.venv/bin/python3'
        ]
      },
      {},
      ['/work/app']
    );
    expect(paths(workspaceInterpreters(host))).toEqual([
      '/work/app/.venv/bin/python3',
      '/work/app/venv/bin/python3'
    ]);
  });

  it('finds an unconventionally named directory carrying a pyvenv.cfg', () => {
    const host = fakeHost(
      {
        executables: ['/work/app/toolchain/bin/python3'],
        files: { '/work/app/toolchain/pyvenv.cfg': 'home = /usr' }
      },
      {},
      ['/work/app']
    );
    expect(paths(workspaceInterpreters(host))).toEqual([
      '/work/app/toolchain/bin/python3'
    ]);
  });

  it('does not walk into unrelated project directories', () => {
    const host = fakeHost(
      { executables: ['/work/app/vendor/thing/bin/python3'] },
      {},
      ['/work/app']
    );
    expect(workspaceInterpreters(host)).toEqual([]);
  });

  it('looks in Scripts on Windows', () => {
    const host = fakeHost(
      { executables: ['C:\\work\\app\\.venv\\Scripts\\python.exe'] },
      { platform: 'win32' },
      ['C:\\work\\app']
    );
    expect(paths(workspaceInterpreters(host))).toEqual([
      'C:\\work\\app\\.venv\\Scripts\\python.exe'
    ]);
  });
});

describe('shebangInterpreterPath', () => {
  const host = fakeHost({ executables: ['/opt/py/bin/python3', '/usr/bin/python'] });

  it('reads an absolute interpreter path off the first line', () => {
    expect(shebangInterpreterPath(host, '#!/opt/py/bin/python3\nprint(1)')).toBe(
      '/opt/py/bin/python3'
    );
  });

  it('tolerates a space after the bang and a CRLF line ending', () => {
    expect(shebangInterpreterPath(host, '#! /usr/bin/python\r\n')).toBe(
      '/usr/bin/python'
    );
  });

  it('ignores a /usr/bin/env shebang, which defers to PATH', () => {
    expect(shebangInterpreterPath(host, '#!/usr/bin/env python3\n')).toBeNull();
  });

  it('ignores a relative path and a non-python interpreter', () => {
    expect(shebangInterpreterPath(host, '#!./venv/bin/python\n')).toBeNull();
    expect(shebangInterpreterPath(host, '#!/bin/sh\n')).toBeNull();
  });

  it('ignores a shebang that names a missing interpreter', () => {
    expect(shebangInterpreterPath(host, '#!/deleted/python3\n')).toBeNull();
  });

  it('returns null when there is no shebang', () => {
    expect(shebangInterpreterPath(host, 'print(1)\n')).toBeNull();
    expect(shebangInterpreterPath(host, null)).toBeNull();
  });
});

describe('shebangInterpreters', () => {
  it('finds the interpreter a top-level script points at', () => {
    const host = fakeHost(
      {
        executables: ['/opt/py/bin/python3'],
        files: { '/work/app/main.py': '#!/opt/py/bin/python3\nprint(1)' }
      },
      {},
      ['/work/app']
    );
    const found = shebangInterpreters(host);
    expect(paths(found)).toEqual(['/opt/py/bin/python3']);
    expect(found[0]?.source).toBe('shebang');
  });

  it('does not read scripts below the project root', () => {
    const host = fakeHost(
      {
        executables: ['/opt/py/bin/python3'],
        files: { '/work/app/scripts/run.py': '#!/opt/py/bin/python3\n' }
      },
      {},
      ['/work/app']
    );
    expect(shebangInterpreters(host)).toEqual([]);
  });

  it('deduplicates when two scripts name the same interpreter', () => {
    const host = fakeHost(
      {
        executables: ['/opt/py/bin/python3'],
        files: {
          '/work/app/a.py': '#!/opt/py/bin/python3\n',
          '/work/app/b.py': '#!/opt/py/bin/python3\n'
        }
      },
      {},
      ['/work/app']
    );
    expect(shebangInterpreters(host)).toHaveLength(1);
  });
});

describe('poetryInterpreters', () => {
  const tree = {
    executables: [
      '/home/dev/.cache/pypoetry/virtualenvs/other-abc-py3.11/bin/python3',
      '/home/dev/.cache/pypoetry/virtualenvs/app-xyz-py3.12/bin/python3'
    ]
  };

  it('promotes the environment belonging to an open project', () => {
    const host = fakeHost(tree, {}, ['/work/app']);
    expect(paths(poetryInterpreters(host))[0]).toBe(
      '/home/dev/.cache/pypoetry/virtualenvs/app-xyz-py3.12/bin/python3'
    );
  });

  it('honours POETRY_VIRTUALENVS_PATH', () => {
    const host = fakeHost(
      { executables: ['/custom/poetry/app-1-py3.12/bin/python3'] },
      { vars: { POETRY_VIRTUALENVS_PATH: '/custom/poetry' } }
    );
    expect(paths(poetryInterpreters(host))).toEqual([
      '/custom/poetry/app-1-py3.12/bin/python3'
    ]);
  });
});

describe('pipenv and virtualenvwrapper', () => {
  it('reads the pipenv data directory', () => {
    const host = fakeHost({
      executables: ['/home/dev/.local/share/virtualenvs/app-h4sh/bin/python3']
    });
    expect(paths(pipenvInterpreters(host))).toEqual([
      '/home/dev/.local/share/virtualenvs/app-h4sh/bin/python3'
    ]);
  });

  it('reads ~/.virtualenvs and respects WORKON_HOME', () => {
    const defaultHost = fakeHost({
      executables: ['/home/dev/.virtualenvs/api/bin/python3']
    });
    expect(paths(virtualenvwrapperInterpreters(defaultHost))).toEqual([
      '/home/dev/.virtualenvs/api/bin/python3'
    ]);

    const customHost = fakeHost(
      { executables: ['/srv/envs/api/bin/python3'] },
      { vars: { WORKON_HOME: '/srv/envs' } }
    );
    expect(paths(virtualenvwrapperInterpreters(customHost))).toEqual([
      '/srv/envs/api/bin/python3'
    ]);
  });
});

describe('pyenvInterpreters', () => {
  const tree = {
    executables: [
      '/home/dev/.pyenv/versions/3.11.6/bin/python3',
      '/home/dev/.pyenv/versions/3.12.4/bin/python3',
      '/home/dev/.pyenv/versions/3.12.4/envs/app/bin/python3'
    ]
  };

  it('lists versions and pyenv-virtualenv environments', () => {
    const host = fakeHost(tree);
    expect(paths(pyenvInterpreters(host))).toContain(
      '/home/dev/.pyenv/versions/3.12.4/envs/app/bin/python3'
    );
  });

  it('promotes the version pinned by .python-version', () => {
    const host = fakeHost(
      { ...tree, files: { '/work/app/.python-version': '3.11.6\n' } },
      {},
      ['/work/app']
    );
    expect(paths(pyenvInterpreters(host))[0]).toBe(
      '/home/dev/.pyenv/versions/3.11.6/bin/python3'
    );
  });

  it('honours PYENV_ROOT', () => {
    const host = fakeHost(
      { executables: ['/opt/pyenv/versions/3.12.4/bin/python3'] },
      { vars: { PYENV_ROOT: '/opt/pyenv' } }
    );
    expect(paths(pyenvInterpreters(host))).toEqual([
      '/opt/pyenv/versions/3.12.4/bin/python3'
    ]);
  });
});

describe('condaInterpreters', () => {
  it('finds the base environment and named environments', () => {
    const host = fakeHost({
      executables: [
        '/home/dev/miniconda3/bin/python3',
        '/home/dev/miniconda3/envs/ml/bin/python3',
        '/home/dev/.conda/envs/scratch/bin/python3'
      ]
    });
    const found = condaInterpreters(host);
    expect(paths(found)).toEqual([
      '/home/dev/miniconda3/bin/python3',
      '/home/dev/miniconda3/envs/ml/bin/python3',
      '/home/dev/.conda/envs/scratch/bin/python3'
    ]);
    expect(found[0]?.environmentName).toBe('base');
  });
});

describe('discoverInterpreters', () => {
  const tree = {
    executables: [
      '/opt/chosen/bin/python3',
      '/work/app/.venv/bin/python3',
      '/envs/shell/bin/python3',
      '/usr/bin/python3',
      '/usr/local/bin/python3'
    ]
  };

  it('orders locators: selected, configured, shell, workspace, then PATH', () => {
    const host = fakeHost(
      tree,
      {
        vars: { VIRTUAL_ENV: '/envs/shell' },
        pathEntries: ['/usr/bin']
      },
      ['/work/app']
    );

    const found = discoverInterpreters(host, {
      selected: '/opt/chosen/bin/python3',
      configured: ['/usr/local/bin/python3']
    });

    expect(paths(found)).toEqual([
      '/opt/chosen/bin/python3',
      '/usr/local/bin/python3',
      '/envs/shell/bin/python3',
      '/work/app/.venv/bin/python3',
      '/usr/bin/python3'
    ]);
    expect(found.map((entry) => entry.source)).toEqual([
      'selected',
      'setting',
      'shell',
      'workspace',
      'path'
    ]);
  });

  it('ranks a shebang interpreter below the workspace venv and above PATH', () => {
    const host = fakeHost(
      {
        executables: ['/work/app/.venv/bin/python3', '/opt/py/bin/python3', '/usr/bin/python3'],
        files: { '/work/app/main.py': '#!/opt/py/bin/python3\n' }
      },
      { pathEntries: ['/usr/bin'] },
      ['/work/app']
    );
    const found = discoverInterpreters(host);
    expect(found.map((entry) => entry.source)).toEqual([
      'workspace',
      'shebang',
      'path'
    ]);
  });

  it('keeps the highest-priority source when one path is found twice', () => {
    const host = fakeHost(
      { executables: ['/usr/bin/python3'] },
      { pathEntries: ['/usr/bin'] }
    );
    const found = discoverInterpreters(host, {
      selected: '/usr/bin/python3'
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.source).toBe('selected');
  });

  it('returns nothing when there is no python anywhere', () => {
    expect(discoverInterpreters(fakeHost({}))).toEqual([]);
  });

  it('falls back to well-known system directories when PATH is empty', () => {
    const host = fakeHost({ executables: ['/usr/local/bin/python3'] });
    expect(paths(discoverInterpreters(host))).toEqual([
      '/usr/local/bin/python3'
    ]);
  });
});

describe('SOURCE_LABELS', () => {
  it('labels every source a locator can produce', () => {
    const sources: InterpreterSource[] = [
      'selected',
      'setting',
      'shell',
      'workspace',
      'shebang',
      'poetry',
      'pipenv',
      'pyenv',
      'conda',
      'virtualenvwrapper',
      'path',
      'global'
    ];
    for (const source of sources) {
      expect(SOURCE_LABELS[source]).toBeTruthy();
    }
  });
});
