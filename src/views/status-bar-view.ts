import type { Disposable } from 'atom';

export interface StatusBarTile {
  destroy(): void;
}

export interface StatusBar {
  addRightTile(options: { item: HTMLElement; priority: number }): StatusBarTile;
}

/**
 * A status bar entry showing which interpreter is driving completions, and
 * opening the interpreter picker when clicked.
 *
 * The VS Code Python extension puts the same information in the same place;
 * before this, the only way to find out which of several candidate interpreters
 * had been picked was to turn on debug logging.
 */
export class InterpreterStatusView {
  readonly element: HTMLElement;
  private readonly clickListener: () => void;
  private tile: StatusBarTile | null = null;

  constructor(onClick: () => void) {
    this.clickListener = onClick;

    this.element = document.createElement('a');
    this.element.classList.add(
      'autocomplete-python-status',
      'inline-block',
      'text-subtle'
    );
    this.element.addEventListener('click', this.clickListener);
    this.setText('Python');
  }

  /** `label` is the environment name, or the executable name as a fallback. */
  setText(label: string): void {
    this.element.textContent = `🐍 ${label}`;
  }

  setTooltip(title: string): Disposable {
    return atom.tooltips.add(this.element, { title });
  }

  attach(statusBar: StatusBar): void {
    this.tile ??= statusBar.addRightTile({ item: this.element, priority: 10 });
  }

  destroy(): void {
    this.element.removeEventListener('click', this.clickListener);
    this.tile?.destroy();
    this.tile = null;
    this.element.remove();
  }
}
