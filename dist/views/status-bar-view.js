"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterpreterStatusView = void 0;
/**
 * A status bar entry showing which interpreter is driving completions, and
 * opening the interpreter picker when clicked.
 *
 * The VS Code Python extension puts the same information in the same place;
 * before this, the only way to find out which of several candidate interpreters
 * had been picked was to turn on debug logging.
 */
class InterpreterStatusView {
    element;
    clickListener;
    tile = null;
    constructor(onClick) {
        this.clickListener = onClick;
        this.element = document.createElement('a');
        this.element.classList.add('autocomplete-python-status', 'inline-block', 'text-subtle');
        this.element.addEventListener('click', this.clickListener);
        this.setText('Python');
    }
    /** `label` is the environment name, or the executable name as a fallback. */
    setText(label) {
        this.element.textContent = `🐍 ${label}`;
    }
    setTooltip(title) {
        return atom.tooltips.add(this.element, { title });
    }
    attach(statusBar) {
        this.tile ??= statusBar.addRightTile({ item: this.element, priority: 10 });
    }
    destroy() {
        this.element.removeEventListener('click', this.clickListener);
        this.tile?.destroy();
        this.tile = null;
        this.element.remove();
    }
}
exports.InterpreterStatusView = InterpreterStatusView;
//# sourceMappingURL=status-bar-view.js.map