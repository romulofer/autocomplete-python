
import type {
  DiscoveryHost,
  FileSystemProbe,
  HostEnvironment,
  ProjectPaths
} from '../../src/host/types';

export interface FakeTree {
  /** Paths that exist as executable regular files. */
  executables?: string[];
  /** Paths that exist as regular files, mapped to their contents. */
  files?: Record<string, string>;
  /** Directories that exist but hold nothing we care about. */
  dirs?: string[];
}

/**
 * An in-memory filesystem good enough for interpreter discovery: it answers
 * "what is in this directory" and "is this an executable file", which is all the
 * locators ask.
 */
/**
 * Split on either separator so a single fake tree can describe POSIX and
 * Windows layouts regardless of the machine the tests run on.
 */
function dirnameOf(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return index <= 0 ? '' : filePath.slice(0, index);
}

function basenameOf(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function fakeFileSystem(tree: FakeTree): FileSystemProbe {
  const executables = new Set(tree.executables ?? []);
  const files = new Map(Object.entries(tree.files ?? {}));
  const explicitDirs = new Set(tree.dirs ?? []);

  const allFilePaths = [...executables, ...files.keys()];

  // Every ancestor of a known path is a directory.
  const directories = new Set<string>(explicitDirs);
  for (const filePath of [...allFilePaths, ...explicitDirs]) {
    let current = dirnameOf(filePath);
    while (current && current !== dirnameOf(current)) {
      directories.add(current);
      current = dirnameOf(current);
    }
  }

  const isFile = (candidate: string): boolean =>
    executables.has(candidate) || files.has(candidate);

  return {
    readDir(dirPath: string): string[] {
      const entries = new Set<string>();
      for (const candidate of [...allFilePaths, ...directories]) {
        if (dirnameOf(candidate) !== dirPath) continue;
        entries.add(basenameOf(candidate));
      }
      return [...entries].sort();
    },
    readFile: (filePath: string) => files.get(filePath) ?? null,
    isFile,
    isDirectory: (dirPath: string) => directories.has(dirPath) && !isFile(dirPath),
    isExecutableFile: (filePath: string) => executables.has(filePath)
  };
}

export interface FakeEnvOptions {
  platform?: NodeJS.Platform;
  home?: string;
  vars?: Record<string, string>;
  pathEntries?: string[];
}

export function fakeEnvironment(options: FakeEnvOptions = {}): HostEnvironment {
  const vars = options.vars ?? {};
  return {
    platform: options.platform ?? 'linux',
    homedir: () => options.home ?? '/home/dev',
    get: (name: string) => vars[name],
    pathEntries: () => options.pathEntries ?? []
  };
}

export function fakeProject(paths: string[] = []): ProjectPaths {
  return { getPaths: () => paths };
}

export function fakeHost(
  tree: FakeTree,
  env: FakeEnvOptions = {},
  projectPaths: string[] = []
): DiscoveryHost {
  return {
    fs: fakeFileSystem(tree),
    env: fakeEnvironment(env),
    project: fakeProject(projectPaths)
  };
}
