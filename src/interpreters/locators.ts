/**
 * Python interpreter discovery.
 *
 * The set of locators, and the order they are consulted in, follows the VS Code
 * Python extension: an explicit choice wins, then configuration, then the
 * environment the editor was launched from, then anything belonging to the open
 * project, then environments managed by a tool (Poetry, Pipenv, pyenv, Conda,
 * virtualenvwrapper), then whatever is merely on `PATH`.
 *
 * Every function takes a {@link DiscoveryHost}, so the whole module runs against
 * a fake filesystem in the tests.
 */

import * as path from 'path';
import { applySubstitutions } from '../config';
import type { DiscoveryHost } from '../host/types';

/** How an interpreter was found. Shown in the picker and in diagnostics. */
export type InterpreterSource =
  | 'selected'
  | 'setting'
  | 'shell'
  | 'workspace'
  | 'shebang'
  | 'poetry'
  | 'pipenv'
  | 'pyenv'
  | 'conda'
  | 'virtualenvwrapper'
  | 'path'
  | 'global';

export interface DiscoveredInterpreter {
  /** Absolute path to the executable. */
  filePath: string;
  source: InterpreterSource;
  /** Environment name when the interpreter belongs to one, e.g. `.venv`. */
  environmentName: string | null;
}

export interface DiscoveryOptions {
  /** `selectedInterpreter` from the settings. */
  selected?: string;
  /** `pythonPaths` from the settings, already split. */
  configured?: readonly string[];
}

export const SOURCE_LABELS: Record<InterpreterSource, string> = {
  selected: 'Selected',
  setting: 'Configured in settings',
  shell: 'Active shell environment',
  workspace: 'Workspace virtual environment',
  shebang: 'Script shebang',
  poetry: 'Poetry',
  pipenv: 'Pipenv',
  pyenv: 'pyenv',
  conda: 'Conda',
  virtualenvwrapper: 'virtualenvwrapper',
  path: 'PATH',
  global: 'System'
};

/**
 * Directory names that hold a virtual environment often enough to be worth
 * probing directly. Anything else inside a project only counts when it carries
 * a `pyvenv.cfg`, so a large project never costs a recursive scan.
 */
const COMMON_VENV_DIR_NAMES = ['.venv', 'venv', '.env', 'env', 'virtualenv'];

function isWindows(host: DiscoveryHost): boolean {
  return host.env.platform === 'win32';
}

/**
 * Path helpers matching the host's platform rather than the process's. In
 * production these are the same thing; separating them is what lets the tests
 * exercise the Windows layout from any machine.
 */
function pathFor(host: DiscoveryHost): path.PlatformPath {
  return isWindows(host) ? path.win32 : path.posix;
}

/** `python`, `python3`, `python3.12` (plus `.exe` on Windows). */
function executablePattern(host: DiscoveryHost): RegExp {
  return isWindows(host)
    ? /^python(\d+(\.\d+)?)?\.exe$/i
    : /^python(\d+(\.\d+)?)?$/;
}

/** Where a virtual environment keeps its executables. */
function venvBinDirs(host: DiscoveryHost): string[] {
  return isWindows(host) ? ['Scripts', 'bin'] : ['bin'];
}

/**
 * Rank interpreters found in one directory: `python3` beats `python3.12` beats
 * bare `python`. Bare `python` comes last because on most systems it is either
 * absent or a legacy Python 2.
 */
export function interpreterRank(filePath: string): number {
  // Split on either separator: this runs against Windows paths too.
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const name = base.replace(/\.exe$/i, '').toLowerCase();
  if (name === 'python3') return 0;
  if (/^python3\.\d+$/.test(name)) return 1;
  if (name === 'python') return 2;
  return 3;
}

/**
 * Every python executable directly inside `dirPath`, best candidate first.
 *
 * Only executable *regular files* qualify. That check matters: a directory
 * named `python` on `PATH` used to be returned as the interpreter, after which
 * the editor hung waiting on a process that never started. Upstream issue #251.
 */
export function executablesIn(host: DiscoveryHost, dirPath: string): string[] {
  if (!dirPath) return [];
  const pattern = executablePattern(host);
  return host.fs
    .readDir(dirPath)
    .filter((fileName) => pattern.test(fileName))
    .map((fileName) => pathFor(host).join(dirPath, fileName))
    .filter((filePath) => host.fs.isExecutableFile(filePath))
    .sort((a, b) => interpreterRank(a) - interpreterRank(b));
}

/** `true` when `dirPath` looks like a venv / virtualenv / conda env root. */
export function isEnvironmentRoot(
  host: DiscoveryHost,
  dirPath: string
): boolean {
  return host.fs.isFile(pathFor(host).join(dirPath, 'pyvenv.cfg'));
}

/** The python executables of one environment root (`bin/` or `Scripts/`). */
export function environmentInterpreters(
  host: DiscoveryHost,
  envRoot: string,
  source: InterpreterSource,
  environmentName?: string
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const binDir of venvBinDirs(host)) {
    for (const filePath of executablesIn(host, pathFor(host).join(envRoot, binDir))) {
      found.push({
        filePath,
        source,
        environmentName: environmentName ?? pathFor(host).basename(envRoot)
      });
    }
  }
  return found;
}

/** Each immediate subdirectory of `dirPath` treated as an environment root. */
export function environmentsIn(
  host: DiscoveryHost,
  dirPath: string,
  source: InterpreterSource
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const entry of host.fs.readDir(dirPath)) {
    const envRoot = pathFor(host).join(dirPath, entry);
    if (!host.fs.isDirectory(envRoot)) continue;
    found.push(...environmentInterpreters(host, envRoot, source, entry));
  }
  return found;
}

/**
 * The environment an executable belongs to, inferred from its layout:
 * `<env>/bin/python` -> `<env>`. `null` for interpreters that sit directly in a
 * system directory.
 */
export function environmentNameFor(
  host: DiscoveryHost,
  filePath: string
): string | null {
  const binDir = pathFor(host).dirname(filePath);
  if (!venvBinDirs(host).includes(pathFor(host).basename(binDir))) return null;
  const envRoot = pathFor(host).dirname(binDir);
  return isEnvironmentRoot(host, envRoot) ? pathFor(host).basename(envRoot) : null;
}

// --- individual locators --------------------------------------------------

export function selectedInterpreter(
  host: DiscoveryHost,
  selected: string | undefined
): DiscoveredInterpreter[] {
  const filePath = (selected ?? '').trim();
  if (!filePath || !host.fs.isExecutableFile(filePath)) return [];
  return [
    {
      filePath,
      source: 'selected',
      environmentName: environmentNameFor(host, filePath)
    }
  ];
}

export function configuredInterpreters(
  host: DiscoveryHost,
  configured: readonly string[] = []
): DiscoveredInterpreter[] {
  return applySubstitutions(configured, host.project.getPaths())
    .map((candidate) => candidate.trim())
    .filter(
      (candidate) => candidate.length > 0 && host.fs.isExecutableFile(candidate)
    )
    .map((filePath) => ({
      filePath,
      source: 'setting' as const,
      environmentName: environmentNameFor(host, filePath)
    }));
}

/**
 * The environment Pulsar itself was launched from. If the user started the
 * editor from an activated virtualenv or conda environment, that is almost
 * certainly the environment they want completions for.
 */
export function shellEnvironmentInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const envVar of ['VIRTUAL_ENV', 'CONDA_PREFIX']) {
    const prefix = host.env.get(envVar);
    if (!prefix) continue;
    found.push(...environmentInterpreters(host, prefix, 'shell'));
  }
  return found;
}

/** Virtual environments living inside the open projects. */
export function workspaceInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const projectPath of host.project.getPaths()) {
    const candidates = host.fs
      .readDir(projectPath)
      .filter(
        (entry) =>
          COMMON_VENV_DIR_NAMES.includes(entry) ||
          isEnvironmentRoot(host, pathFor(host).join(projectPath, entry))
      )
      // Keep the conventional names ahead of anything found by probing.
      .sort((a, b) => {
        const rankA = COMMON_VENV_DIR_NAMES.indexOf(a);
        const rankB = COMMON_VENV_DIR_NAMES.indexOf(b);
        return (
          (rankA < 0 ? Number.MAX_SAFE_INTEGER : rankA) -
          (rankB < 0 ? Number.MAX_SAFE_INTEGER : rankB)
        );
      });

    for (const candidate of candidates) {
      found.push(
        ...environmentInterpreters(
          host,
          pathFor(host).join(projectPath, candidate),
          'workspace',
          candidate
        )
      );
    }
  }
  return found;
}

/**
 * The interpreter a script names on its `#!` line, or `null`.
 *
 * Only an absolute path to a python executable counts. A
 * `#!/usr/bin/env python3` shebang names no interpreter of its own, it defers
 * to `PATH`, which is already a locator, so it is ignored. A relative path
 * cannot be resolved without guessing a working directory, so it is ignored
 * too. The executable must exist and be a regular file, the same bar every
 * other locator holds a candidate to (upstream issue #251).
 */
export function shebangInterpreterPath(
  host: DiscoveryHost,
  contents: string | null
): string | null {
  if (!contents) return null;
  const firstLine = contents.split(/\r?\n/, 1)[0] ?? '';
  const match = /^#!\s*(\S+)/.exec(firstLine);
  const executable = match?.[1];
  if (!executable) return null;

  const base = pathFor(host).basename(executable);
  // `#!/usr/bin/env python`: the real interpreter is the argument, not `env`.
  if (/^env(\.exe)?$/i.test(base)) return null;
  if (!executablePattern(host).test(base)) return null;
  if (!pathFor(host).isAbsolute(executable)) return null;
  if (!host.fs.isExecutableFile(executable)) return null;
  return executable;
}

/**
 * Interpreters named by the `#!` line of a script at a project root.
 *
 * A shebang is an explicit statement of the interpreter a script was written
 * for, so it outranks the tool-managed caches below. Only the top level of each
 * project is read: that keeps the scan bounded, the same reason
 * {@link workspaceInterpreters} does not recurse. Upstream issue #270.
 */
export function shebangInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  const seen = new Set<string>();
  for (const projectPath of host.project.getPaths()) {
    for (const entry of host.fs.readDir(projectPath)) {
      if (!entry.endsWith('.py')) continue;
      const filePath = pathFor(host).join(projectPath, entry);
      if (!host.fs.isFile(filePath)) continue;
      const interpreter = shebangInterpreterPath(host, host.fs.readFile(filePath));
      if (!interpreter || seen.has(interpreter)) continue;
      seen.add(interpreter);
      found.push({
        filePath: interpreter,
        source: 'shebang',
        environmentName: environmentNameFor(host, interpreter)
      });
    }
  }
  return found;
}

/** Where Poetry keeps the environments it creates. */
export function poetryCacheDirs(host: DiscoveryHost): string[] {
  const override = host.env.get('POETRY_VIRTUALENVS_PATH');
  if (override) return [override];

  const home = host.env.homedir();
  if (isWindows(host)) {
    const appData =
      host.env.get('LOCALAPPDATA') ?? pathFor(host).join(home, 'AppData', 'Local');
    return [pathFor(host).join(appData, 'pypoetry', 'Cache', 'virtualenvs')];
  }
  if (host.env.platform === 'darwin') {
    return [pathFor(host).join(home, 'Library', 'Caches', 'pypoetry', 'virtualenvs')];
  }
  return [pathFor(host).join(home, '.cache', 'pypoetry', 'virtualenvs')];
}

/**
 * Poetry names environments `<project>-<hash>-py<version>`, so environments
 * belonging to an open project are promoted above the rest.
 */
export function poetryInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const projectNames = host.project
    .getPaths()
    .map((projectPath) => pathFor(host).basename(projectPath).toLowerCase());

  const found: DiscoveredInterpreter[] = [];
  for (const cacheDir of poetryCacheDirs(host)) {
    found.push(...environmentsIn(host, cacheDir, 'poetry'));
  }

  const belongsToProject = (entry: DiscoveredInterpreter): boolean =>
    projectNames.some((name) =>
      (entry.environmentName ?? '').toLowerCase().startsWith(name)
    );
  return found.sort(
    (a, b) => Number(belongsToProject(b)) - Number(belongsToProject(a))
  );
}

/** Pipenv stores its environments under the user data directory. */
export function pipenvInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const workonHome = host.env.get('WORKON_HOME');
  const home = host.env.homedir();
  const root =
    workonHome ??
    (isWindows(host)
      ? pathFor(host).join(
          host.env.get('LOCALAPPDATA') ?? pathFor(host).join(home, 'AppData', 'Local'),
          'virtualenvs'
        )
      : pathFor(host).join(home, '.local', 'share', 'virtualenvs'));
  return environmentsIn(host, root, 'pipenv');
}

/** `~/.virtualenvs`, or wherever `WORKON_HOME` points. */
export function virtualenvwrapperInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const root =
    host.env.get('WORKON_HOME') ?? pathFor(host).join(host.env.homedir(), '.virtualenvs');
  return environmentsIn(host, root, 'virtualenvwrapper');
}

export function pyenvRoot(host: DiscoveryHost): string {
  return (
    host.env.get('PYENV_ROOT') ?? pathFor(host).join(host.env.homedir(), '.pyenv')
  );
}

/**
 * pyenv versions, with the version pinned by a project's `.python-version` file
 * promoted to the front - that file is how pyenv itself decides which
 * interpreter a directory uses.
 */
export function pyenvInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const versionsDir = pathFor(host).join(pyenvRoot(host), 'versions');
  const found: DiscoveredInterpreter[] = [];

  for (const version of host.fs.readDir(versionsDir)) {
    const envRoot = pathFor(host).join(versionsDir, version);
    if (!host.fs.isDirectory(envRoot)) continue;
    found.push(...environmentInterpreters(host, envRoot, 'pyenv', version));
    // pyenv-virtualenv keeps its environments one level deeper.
    found.push(...environmentsIn(host, pathFor(host).join(envRoot, 'envs'), 'pyenv'));
  }

  const pinned = new Set(
    host.project
      .getPaths()
      .map((projectPath) =>
        host.fs.readFile(pathFor(host).join(projectPath, '.python-version'))?.trim()
      )
      .filter((version): version is string => Boolean(version))
  );
  if (pinned.size === 0) return found;

  return found.sort(
    (a, b) =>
      Number(pinned.has(b.environmentName ?? '')) -
      Number(pinned.has(a.environmentName ?? ''))
  );
}

export function condaRoots(host: DiscoveryHost): string[] {
  const home = host.env.homedir();
  return [
    host.env.get('CONDA_ROOT'),
    pathFor(host).join(home, 'anaconda3'),
    pathFor(host).join(home, 'miniconda3'),
    pathFor(host).join(home, 'miniforge3'),
    pathFor(host).join(home, 'mambaforge'),
    isWindows(host) ? 'C:\\ProgramData\\Anaconda3' : '/opt/conda'
  ].filter((entry): entry is string => Boolean(entry));
}

/** Conda base environments and everything under their `envs/` directory. */
export function condaInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const root of condaRoots(host)) {
    if (!host.fs.isDirectory(root)) continue;
    found.push(...environmentInterpreters(host, root, 'conda', 'base'));
    found.push(...environmentsIn(host, pathFor(host).join(root, 'envs'), 'conda'));
  }
  // `~/.conda/envs` holds environments created with `--name` outside the
  // install root.
  found.push(
    ...environmentsIn(
      host,
      pathFor(host).join(host.env.homedir(), '.conda', 'envs'),
      'conda'
    )
  );
  return found;
}

export function pathInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const dirPath of host.env.pathEntries()) {
    for (const filePath of executablesIn(host, dirPath)) {
      found.push({
        filePath,
        source: 'path',
        environmentName: environmentNameFor(host, filePath)
      });
    }
  }
  return found;
}

/** Directories worth checking when `PATH` holds no python. */
export function globalPythonDirs(host: DiscoveryHost): string[] {
  const home = host.env.homedir();
  if (!isWindows(host)) {
    return [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/opt/homebrew/bin',
      pathFor(host).join(home, '.local', 'bin')
    ];
  }

  // Python installs itself as `C:\PythonXY`, `%ProgramFiles%\PythonXY`, or
  // under the per-user `Programs\Python` directory. Rather than hard-coding
  // version numbers that go stale, list each parent and keep the entries that
  // look like a Python install.
  const parents = [
    'C:\\',
    host.env.get('ProgramFiles') ?? 'C:\\Program Files',
    host.env.get('ProgramFiles(x86)') ?? 'C:\\Program Files (x86)',
    pathFor(host).join(home, 'AppData', 'Local', 'Programs', 'Python')
  ];
  const dirs: string[] = [];
  for (const parent of parents) {
    for (const entry of host.fs.readDir(parent)) {
      if (/^python\s?\d/i.test(entry)) dirs.push(pathFor(host).join(parent, entry));
    }
  }
  return dirs;
}

export function globalInterpreters(
  host: DiscoveryHost
): DiscoveredInterpreter[] {
  const found: DiscoveredInterpreter[] = [];
  for (const dirPath of globalPythonDirs(host)) {
    for (const filePath of executablesIn(host, dirPath)) {
      found.push({ filePath, source: 'global', environmentName: null });
    }
  }
  return found;
}

// --- aggregation ----------------------------------------------------------

/** Every interpreter we know about, highest priority first, deduplicated. */
export function discoverInterpreters(
  host: DiscoveryHost,
  options: DiscoveryOptions = {}
): DiscoveredInterpreter[] {
  const candidates = [
    ...selectedInterpreter(host, options.selected),
    ...configuredInterpreters(host, options.configured),
    ...shellEnvironmentInterpreters(host),
    ...workspaceInterpreters(host),
    ...shebangInterpreters(host),
    ...poetryInterpreters(host),
    ...pipenvInterpreters(host),
    ...pyenvInterpreters(host),
    ...condaInterpreters(host),
    ...virtualenvwrapperInterpreters(host),
    ...pathInterpreters(host),
    ...globalInterpreters(host)
  ];

  // First occurrence wins, so the highest-priority locator keeps the entry.
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.filePath)) return false;
    seen.add(candidate.filePath);
    return true;
  });
}

/** A short label for the status bar, e.g. `.venv` or `python3`. */
export function describeInterpreter(
  interpreter: DiscoveredInterpreter
): string {
  if (interpreter.environmentName) return interpreter.environmentName;
  // Separator-agnostic: this may be a Windows path.
  return interpreter.filePath.split(/[\\/]/).pop() ?? interpreter.filePath;
}
