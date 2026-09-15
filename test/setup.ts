import { mock } from 'bun:test';

/**
 * Stand-ins for the modules only Pulsar can provide.
 *
 * The package is structured so the interesting logic never reaches for these,
 * but the modules that wire it to the editor still import them at load time.
 * These stubs are enough to import those modules and exercise their pure parts.
 */

class Disposable {
  constructor(private readonly disposalAction?: () => void) {}
  dispose(): void {
    this.disposalAction?.();
  }
}

class CompositeDisposable {
  private readonly disposables = new Set<{ dispose(): void }>();
  add(...disposables: { dispose(): void }[]): void {
    for (const disposable of disposables) this.disposables.add(disposable);
  }
  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.clear();
  }
}

class Emitter {
  on(): Disposable {
    return new Disposable();
  }
  emit(): void {}
  dispose(): void {}
}

/** Never spawns anything: the daemon tests inject their own process factory. */
class BufferedProcess {
  process: undefined;
  onWillThrowError(): Disposable {
    return new Disposable();
  }
  kill(): void {}
}

mock.module('atom', () => ({
  Disposable,
  CompositeDisposable,
  Emitter,
  BufferedProcess
}));

/** `etch`-backed and DOM-hungry; no test drives a real list. */
mock.module('atom-select-list', () => ({
  default: class SelectListView {
    element = { remove(): void {} };
    async update(): Promise<void> {}
    async destroy(): Promise<void> {}
    focus(): void {}
  }
}));

/** The `atom` global, with just the surface the imported modules touch. */
const configValues = new Map<string, unknown>();

Object.defineProperty(globalThis, 'atom', {
  configurable: true,
  writable: true,
  value: {
    config: {
      get: (key: string) => configValues.get(key),
      set: (key: string, value: unknown) => configValues.set(key, value),
      observe: () => new Disposable(),
      onDidChange: () => new Disposable()
    },
    project: {
      getPaths: () => [],
      relativizePath: (filePath: string) => [null, filePath],
      onDidChangePaths: () => new Disposable()
    },
    workspace: {
      observeTextEditors: () => new Disposable(),
      getActiveTextEditor: () => undefined,
      open: async () => undefined,
      addModalPanel: () => ({
        show(): void {},
        hide(): void {},
        destroy(): void {},
        isVisible: () => false
      })
    },
    commands: { add: () => new Disposable(), dispatch: () => {} },
    notifications: {
      addInfo: () => {},
      addSuccess: () => {},
      addWarning: () => {},
      addError: () => {}
    },
    tooltips: { add: () => new Disposable() },
    views: { getView: () => ({ focus(): void {} }) }
  }
});

export {};
