import type { Disposable } from 'atom';
import type { StatusBar, StatusBarTile } from './status-bar-view';

/**
 * The run/stop button in the status bar.
 *
 * It doubles as the run indicator: while a script is going it turns into a stop
 * button, so there is always one visible answer to "is my script still going,
 * and how do I stop it".
 */
export class RunButtonView {
  readonly element: HTMLElement;

  private readonly clickListener: () => void;
  private tile: StatusBarTile | null = null;
  private tooltip: Disposable | null = null;
  private running = false;

  constructor(private readonly onClick: () => void) {
    this.clickListener = () => this.onClick();

    this.element = document.createElement('a');
    this.element.classList.add(
      'autocomplete-python-run-button',
      'inline-block'
    );
    this.element.addEventListener('click', this.clickListener);
    this.setRunning(false);
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.element.textContent = running ? '■' : '▶';
    this.element.classList.toggle('is-running', running);

    this.tooltip?.dispose();
    this.tooltip = atom.tooltips.add(this.element, {
      title: running
        ? 'Stop the running Python script'
        : 'Run this Python file'
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  attach(statusBar: StatusBar): void {
    // Priority above the interpreter tile, so the pair reads "run" then
    // "with which interpreter".
    this.tile ??= statusBar.addRightTile({ item: this.element, priority: 9 });
  }

  /** Shown only for Python files; there is nothing to run otherwise. */
  setVisible(visible: boolean): void {
    this.element.style.display = visible ? '' : 'none';
  }

  destroy(): void {
    this.element.removeEventListener('click', this.clickListener);
    this.tooltip?.dispose();
    this.tooltip = null;
    this.tile?.destroy();
    this.tile = null;
    this.element.remove();
  }
}
