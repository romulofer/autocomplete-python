"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUsagesView = createUsagesView;
const select_list_panel_1 = require("./select-list-panel");
const editor_utils_1 = require("../editor/editor-utils");
/**
 * The picker shown by `autocomplete-python-pulsar:show-usages`.
 *
 * Jedi reports usages with one-based lines, so every buffer position derived
 * from a usage subtracts one.
 */
function createUsagesView() {
    return new select_list_panel_1.SelectListPanel({
        loadingMessage: 'Looking for usages…',
        emptyMessage: 'No usages found',
        filterKeyForItem: (usage) => `${usage.name} ${(0, editor_utils_1.relativize)(usage.fileName)}`,
        elementForItem: (usage) => (0, select_list_panel_1.twoLineListItem)(usage.name, `${(0, editor_utils_1.relativize)(usage.fileName)}, line ${usage.line}`),
        // Preview the highlighted usage in the editor behind the panel, but only
        // when it is already the active one - opening a file per arrow key press
        // would be far too eager.
        didChangeSelection: (usage) => {
            if (!usage)
                return;
            const editor = atom.workspace.getActiveTextEditor();
            if (!editor || editor.getPath() !== usage.fileName)
                return;
            editor.setSelectedBufferRange([
                [usage.line - 1, usage.column],
                [usage.line - 1, usage.column + usage.name.length]
            ]);
            editor.scrollToBufferPosition([usage.line - 1, usage.column], {
                center: true
            });
        },
        didConfirmSelection: (usage) => {
            void (0, editor_utils_1.openAndReveal)(usage.fileName, usage.line - 1, usage.column, usage.name.length);
        }
    });
}
//# sourceMappingURL=usages-view.js.map