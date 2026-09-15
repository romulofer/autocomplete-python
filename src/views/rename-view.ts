import { CompositeDisposable } from 'atom';
import type { Panel, TextEditor } from 'atom';
import type { Usage } from '../daemon/protocol';

/**
 * The single-field prompt shown by `autocomplete-python:rename`.
 *
 * Built from a mini `TextEditor` and plain DOM. It used to extend `space-pen`'s
 * `View`, which is jQuery-backed and unmaintained.
 */
export class RenameView {
  private readonly element: HTMLElement;
  private readonly miniEditor: TextEditor;
  private readonly disposables = new CompositeDisposable();
  private panel: Panel<HTMLElement> | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;
  private destroyed = false;

  constructor(usages: readonly Usage[]) {
    const name = usages[0]?.name ?? '';

    this.element = document.createElement('div');
    this.element.classList.add('autocomplete-python-rename');

    const label = document.createElement('label');
    label.textContent =
      `Type a new name to replace ${usages.length} ` +
      `${usages.length === 1 ? 'occurrence' : 'occurrences'} of ${name} within the project:`;

    this.miniEditor = atom.workspace.buildTextEditor({ mini: true });
    this.miniEditor.setPlaceholderText(name);

    this.element.append(label, atom.views.getView(this.miniEditor));

    this.disposables.add(
      atom.commands.add(this.element, {
        'core:cancel': () => this.destroy()
      })
    );
  }

  /** Show the prompt and invoke `callback` when the user confirms a new name. */
  onInput(callback: (newName: string) => void): void {
    this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
    this.panel ??= atom.workspace.addModalPanel({ item: this.element });
    this.panel.show();

    this.disposables.add(
      atom.commands.add(this.element, {
        'core:confirm': () => {
          const newName = this.miniEditor.getText().trim();
          this.destroy();
          if (newName.length > 0) callback(newName);
        }
      })
    );

    atom.views.getView(this.miniEditor).focus();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.disposables.dispose();
    this.panel?.destroy();
    this.panel = null;
    this.miniEditor.destroy();
    this.previouslyFocusedElement?.focus();
    this.previouslyFocusedElement = null;
  }
}
