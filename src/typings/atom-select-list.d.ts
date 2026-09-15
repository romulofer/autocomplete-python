/**
 * Hand-written types for `atom-select-list`, which ships no declarations.
 * Only the subset of the API this package uses is declared.
 */
declare module 'atom-select-list' {
  interface SelectListProperties<T> {
    items: T[];
    elementForItem: (item: T, options: { selected: boolean; index: number; visible: boolean }) => HTMLElement;
    filterKeyForItem?: (item: T) => string;
    filter?: (items: T[], query: string) => T[];
    filterQuery?: (query: string) => string;
    query?: string;
    order?: (a: T, b: T) => number;
    maxResults?: number;
    emptyMessage?: string;
    errorMessage?: string;
    infoMessage?: string;
    loadingMessage?: string;
    loadingBadge?: string | number;
    itemsClassList?: string[];
    initiallyVisibleItemCount?: number;
    didChangeQuery?: (query: string) => void;
    didChangeSelection?: (item: T | null) => void;
    didConfirmSelection?: (item: T) => void;
    didConfirmEmptySelection?: () => void;
    didCancelSelection?: () => void;
  }

  class SelectListView<T> {
    constructor(properties: SelectListProperties<T>);
    element: HTMLElement;
    update(properties: Partial<SelectListProperties<T>>): Promise<void>;
    destroy(): Promise<void>;
    focus(): void;
    reset(): void;
    getQuery(): string;
    getFilterQuery(): string;
    getSelectedItem(): T | null;
    selectNext(): Promise<void>;
    selectPrevious(): Promise<void>;
  }

  export = SelectListView;
}
