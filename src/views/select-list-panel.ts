import SelectListView from 'atom-select-list';
import type { Panel } from 'atom';

export interface SelectListPanelOptions<T> {
  /** Shown while the daemon is still working. */
  loadingMessage: string;
  /** Shown once results arrive and there are none. */
  emptyMessage: string;
  elementForItem: (item: T) => HTMLElement;
  filterKeyForItem: (item: T) => string;
  didConfirmSelection: (item: T) => void;
  /** Called as the highlighted row changes, for live preview in the editor. */
  didChangeSelection?: (item: T | null) => void;
}

/**
 * A modal `atom-select-list` with the focus and panel bookkeeping this package
 * needs. Replaces the jQuery `SelectListView` from atom-space-pen-views, which
 * has been unmaintained since the Atom era; `atom-select-list` is what Pulsar's
 * own bundled packages use.
 */
export class SelectListPanel<T> {
  private readonly selectListView: SelectListView<T>;
  private readonly didConfirmSelection: (item: T) => void;
  private panel: Panel<HTMLElement> | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;
  private destroyed = false;
  private currentItems: T[] = [];

  constructor(options: SelectListPanelOptions<T>) {
    this.didConfirmSelection = options.didConfirmSelection;
    this.selectListView = new SelectListView<T>({
      items: [],
      loadingMessage: options.loadingMessage,
      emptyMessage: options.emptyMessage,
      elementForItem: (item) => options.elementForItem(item),
      filterKeyForItem: (item) => options.filterKeyForItem(item),
      didConfirmSelection: (item) => this.confirmItem(item),
      didCancelSelection: () => void this.destroy(),
      ...(options.didChangeSelection
        ? { didChangeSelection: options.didChangeSelection }
        : {})
    });
  }

  /** Open the panel in its loading state. */
  show(): void {
    if (this.destroyed) return;
    this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
    this.panel ??= atom.workspace.addModalPanel({
      item: this.selectListView.element
    });
    this.panel.show();
    this.selectListView.focus();
  }

  /** Swap in the results and clear the loading state. */
  async setItems(items: T[]): Promise<void> {
    if (this.destroyed) return;
    this.currentItems = items;
    await this.selectListView.update({ items, loadingMessage: '' });
  }

  /** Confirm an item without user interaction, e.g. the single-result case. */
  confirmItem(item: T): void {
    this.didConfirmSelection(item);
    void this.destroy();
  }

  get items(): readonly T[] {
    return this.currentItems;
  }

  get element(): HTMLElement {
    return this.selectListView.element;
  }

  isVisible(): boolean {
    return this.panel?.isVisible() ?? false;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.panel?.destroy();
    this.panel = null;
    await this.selectListView.destroy();
    this.previouslyFocusedElement?.focus();
    this.previouslyFocusedElement = null;
  }
}

/**
 * Build the two-line row used by every list in this package: a primary line
 * with a dimmed secondary line underneath.
 */
export function twoLineListItem(
  primary: string,
  secondary: string
): HTMLElement {
  const li = document.createElement('li');
  li.classList.add('two-lines');

  const primaryLine = document.createElement('div');
  primaryLine.classList.add('primary-line');
  primaryLine.textContent = primary;

  const secondaryLine = document.createElement('div');
  secondaryLine.classList.add('secondary-line');
  secondaryLine.textContent = secondary;

  li.append(primaryLine, secondaryLine);
  return li;
}
