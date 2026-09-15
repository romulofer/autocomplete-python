/**
 * Building the command line for "run this file".
 *
 * Pure: it takes an interpreter, a file and the settings, and returns what to
 * spawn. No process, no editor, no filesystem.
 */

import * as path from 'path';

export type WorkingDirectoryMode = 'file' | 'project';

export interface RunCommandInput {
  /** Absolute path to the Python executable. */
  interpreter: string;
  /** Absolute path to the file to run. */
  filePath: string;
  /** Extra arguments for the script, already split. */
  scriptArguments?: readonly string[];
  /** Open project roots, used to resolve `project` mode. */
  projectPaths?: readonly string[];
  workingDirectory?: WorkingDirectoryMode;
}

export interface RunCommand {
  command: string;
  args: string[];
  cwd: string;
}

/**
 * Split a settings string into arguments, honouring quoted runs so a path with
 * a space survives. Deliberately simple: no shell is involved, so there is
 * nothing here to escape into.
 */
export function splitArguments(value: string): string[] {
  const matches = value.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => {
    const quoted = /^(".*"|'.*')$/s.test(token);
    return quoted ? token.slice(1, -1) : token;
  });
}

/**
 * The project root containing `filePath`, or `null` when it sits outside every
 * open project. The longest matching root wins, so a nested project root is
 * preferred over its parent.
 */
export function projectRootFor(
  filePath: string,
  projectPaths: readonly string[]
): string | null {
  const matches = projectPaths.filter(
    (projectPath) =>
      filePath === projectPath ||
      filePath.startsWith(projectPath.endsWith(path.sep) ? projectPath : projectPath + path.sep)
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, candidate) =>
    candidate.length > longest.length ? candidate : longest
  );
}

/**
 * Where the script should run from.
 *
 * `file` mode matches what `python script.py` does in a terminal, which is what
 * relative paths inside the script expect. `project` mode matches how the code
 * usually runs in production, where the repository root is the working
 * directory. Falls back to the file's directory when the file is outside every
 * open project.
 */
export function resolveWorkingDirectory(
  filePath: string,
  projectPaths: readonly string[],
  mode: WorkingDirectoryMode
): string {
  if (mode === 'project') {
    const root = projectRootFor(filePath, projectPaths);
    if (root) return root;
  }
  return path.dirname(filePath);
}

export function buildRunCommand(input: RunCommandInput): RunCommand {
  const {
    interpreter,
    filePath,
    scriptArguments = [],
    projectPaths = [],
    workingDirectory = 'file'
  } = input;

  return {
    command: interpreter,
    // `-u` keeps stdout unbuffered, so output appears as the script produces it
    // rather than all at once when it exits.
    args: ['-u', filePath, ...scriptArguments],
    cwd: resolveWorkingDirectory(filePath, projectPaths, workingDirectory)
  };
}

/** A short, readable form of the command, shown in the output header. */
export function describeRunCommand(runCommand: RunCommand): string {
  return [path.basename(runCommand.command), ...runCommand.args]
    .map((token) => (token.includes(' ') ? `"${token}"` : token))
    .join(' ');
}
