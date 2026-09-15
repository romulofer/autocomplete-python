"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefinitionsView = createDefinitionsView;
const select_list_panel_1 = require("./select-list-panel");
const editor_utils_1 = require("../editor/editor-utils");
/** The picker shown by `autocomplete-python:go-to-definition`. */
function createDefinitionsView() {
    return new select_list_panel_1.SelectListPanel({
        loadingMessage: 'Looking for definitions…',
        emptyMessage: 'No definition found',
        filterKeyForItem: (definition) => `${definition.text} ${(0, editor_utils_1.relativize)(definition.fileName)}`,
        elementForItem: (definition) => (0, select_list_panel_1.twoLineListItem)(`${definition.type} ${definition.text}`, `${(0, editor_utils_1.relativize)(definition.fileName)}, line ${definition.line + 1}`),
        didConfirmSelection: (definition) => {
            void (0, editor_utils_1.openAndReveal)(definition.fileName, definition.line, definition.column);
        }
    });
}
//# sourceMappingURL=definitions-view.js.map