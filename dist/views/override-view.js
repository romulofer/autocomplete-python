"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertOverride = insertOverride;
exports.createOverrideView = createOverrideView;
const select_list_panel_1 = require("./select-list-panel");
const editor_utils_1 = require("../editor/editor-utils");
const override_1 = require("../editor/override");
/** Write the override stub at the given position. */
function insertOverride(editor, method, row, column) {
    const snippet = (0, override_1.buildOverrideSnippet)(method, {
        indent: (0, editor_utils_1.leadingWhitespace)(editor, row, column),
        tab: editor.getTabText()
    });
    editor.setCursorBufferPosition([row, column]);
    editor.insertText(snippet, {
        autoIndent: false,
        autoIndentNewline: false
    });
}
/** The picker shown by `autocomplete-python-pulsar:override-method`. */
function createOverrideView(onConfirm) {
    return new select_list_panel_1.SelectListPanel({
        loadingMessage: 'Looking for methods…',
        emptyMessage: 'No methods found',
        filterKeyForItem: (method) => `${method.parent}.${method.name}`,
        elementForItem: (method) => (0, select_list_panel_1.twoLineListItem)(`${method.parent}.${method.name}`, method.line && method.fileName
            ? `${(0, editor_utils_1.relativize)(method.fileName)}, line ${method.line}`
            : 'builtin'),
        didConfirmSelection: onConfirm
    });
}
//# sourceMappingURL=override-view.js.map