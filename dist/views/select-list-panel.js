"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectListPanel = void 0;
exports.twoLineListItem = twoLineListItem;
const atom_select_list_1 = __importDefault(require("atom-select-list"));
/**
 * A modal `atom-select-list` with the focus and panel bookkeeping this package
 * needs. Replaces the jQuery `SelectListView` from atom-space-pen-views, which
 * has been unmaintained since the Atom era; `atom-select-list` is what Pulsar's
 * own bundled packages use.
 */
class SelectListPanel {
    selectListView;
    didConfirmSelection;
    panel = null;
    previouslyFocusedElement = null;
    destroyed = false;
    currentItems = [];
    constructor(options) {
        this.didConfirmSelection = options.didConfirmSelection;
        this.selectListView = new atom_select_list_1.default({
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
    show() {
        if (this.destroyed)
            return;
        this.previouslyFocusedElement = document.activeElement;
        this.panel ??= atom.workspace.addModalPanel({
            item: this.selectListView.element
        });
        this.panel.show();
        this.selectListView.focus();
    }
    /** Swap in the results and clear the loading state. */
    async setItems(items) {
        if (this.destroyed)
            return;
        this.currentItems = items;
        await this.selectListView.update({ items, loadingMessage: '' });
    }
    /** Confirm an item without user interaction, e.g. the single-result case. */
    confirmItem(item) {
        this.didConfirmSelection(item);
        void this.destroy();
    }
    get items() {
        return this.currentItems;
    }
    get element() {
        return this.selectListView.element;
    }
    isVisible() {
        return this.panel?.isVisible() ?? false;
    }
    async destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.panel?.destroy();
        this.panel = null;
        await this.selectListView.destroy();
        this.previouslyFocusedElement?.focus();
        this.previouslyFocusedElement = null;
    }
}
exports.SelectListPanel = SelectListPanel;
/**
 * Build the two-line row used by every list in this package: a primary line
 * with a dimmed secondary line underneath.
 */
function twoLineListItem(primary, secondary) {
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
//# sourceMappingURL=select-list-panel.js.map