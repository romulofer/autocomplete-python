/**
 * The narrow slice of the host environment this package depends on.
 *
 * Everything below `src/host/` is the only place allowed to touch the `atom`
 * global, Node's `fs`, or `process.env`. The rest of the package takes these
 * interfaces as parameters, which is what makes the interesting logic -
 * interpreter discovery above all - testable without a running editor.
 */

/** Read-only filesystem probing, as interpreter discovery needs it. */
export interface FileSystemProbe {
  /** Entry names inside a directory; empty when it cannot be read. */
  readDir(dirPath: string): string[];
  /** File contents, or `null` when unreadable. */
  readFile(filePath: string): string | null;
  isFile(filePath: string): boolean;
  isDirectory(dirPath: string): boolean;
  /** An executable regular file - a directory of that name does not count. */
  isExecutableFile(filePath: string): boolean;
}

/** The parts of the process environment the locators consult. */
export interface HostEnvironment {
  platform: NodeJS.Platform;
  homedir(): string;
  /** `undefined` for unset variables, like `process.env`. */
  get(name: string): string | undefined;
  /** `PATH`, already split on the platform delimiter. */
  pathEntries(): string[];
}

/** Where the user's project roots come from. */
export interface ProjectPaths {
  getPaths(): string[];
}

/** User-facing messages, so core code never reaches for `atom.notifications`. */
export interface Notifier {
  info(message: string, options?: NotificationOptions): void;
  success(message: string, options?: NotificationOptions): void;
  warning(message: string, options?: NotificationOptions): void;
  error(message: string, options?: NotificationOptions): void;
}

export interface NotificationOptions {
  description?: string;
  detail?: string;
  dismissable?: boolean;
  buttons?: Array<{ text: string; onDidClick: () => void }>;
}

/** Everything the interpreter locators need, in one bag. */
export interface DiscoveryHost {
  fs: FileSystemProbe;
  env: HostEnvironment;
  project: ProjectPaths;
}
