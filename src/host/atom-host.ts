/**
 * Real implementations of the host interfaces, backed by Node and the `atom`
 * global. Importing this module is the only way the package reaches either.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  DiscoveryHost,
  FileSystemProbe,
  HostEnvironment,
  NotificationOptions,
  Notifier,
  ProjectPaths
} from './types';

export const nodeFileSystem: FileSystemProbe = {
  readDir(dirPath: string): string[] {
    try {
      return fs.readdirSync(dirPath);
    } catch {
      return [];
    }
  },

  readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  },

  isFile(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  },

  isDirectory(dirPath: string): boolean {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  },

  isExecutableFile(filePath: string): boolean {
    try {
      if (!fs.statSync(filePath).isFile()) return false;
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
};

export const nodeEnvironment: HostEnvironment = {
  platform: process.platform,
  homedir: () => os.homedir(),
  get: (name: string) => process.env[name],
  pathEntries: () =>
    (process.env.PATH ?? '')
      .split(path.delimiter)
      .filter((entry) => entry.length > 0)
};

export const atomProjectPaths: ProjectPaths = {
  getPaths: () => atom.project.getPaths()
};

export const atomNotifier: Notifier = {
  info: (message, options) =>
    atom.notifications.addInfo(message, options as NotificationOptions),
  success: (message, options) =>
    atom.notifications.addSuccess(message, options as NotificationOptions),
  warning: (message, options) =>
    atom.notifications.addWarning(message, options as NotificationOptions),
  error: (message, options) =>
    atom.notifications.addError(message, options as NotificationOptions)
};

export const atomDiscoveryHost: DiscoveryHost = {
  fs: nodeFileSystem,
  env: nodeEnvironment,
  project: atomProjectPaths
};
