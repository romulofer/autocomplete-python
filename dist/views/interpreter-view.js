"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInterpreterView = createInterpreterView;
const select_list_panel_1 = require("./select-list-panel");
const locators_1 = require("../interpreters/locators");
/**
 * The interpreter picker, modelled on the VS Code Python extension's
 * "Select Interpreter" quick pick: one row per discovered interpreter, labelled
 * with the environment it belongs to and the locator that found it.
 */
function createInterpreterView(onConfirm) {
    return new select_list_panel_1.SelectListPanel({
        loadingMessage: 'Looking for Python interpreters…',
        emptyMessage: 'No Python interpreter found',
        filterKeyForItem: (interpreter) => `${interpreter.environmentName ?? ''} ${interpreter.filePath}`,
        elementForItem: (interpreter) => (0, select_list_panel_1.twoLineListItem)(interpreter.environmentName
            ? `${interpreter.environmentName} (${locators_1.SOURCE_LABELS[interpreter.source]})`
            : locators_1.SOURCE_LABELS[interpreter.source], interpreter.filePath),
        didConfirmSelection: onConfirm
    });
}
//# sourceMappingURL=interpreter-view.js.map