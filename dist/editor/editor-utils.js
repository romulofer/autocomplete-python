"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAndReveal = openAndReveal;
exports.relativize = relativize;
exports.leadingWhitespace = leadingWhitespace;
/**
 * Open `fileName`, put the cursor at `row`/`column` (both zero-based) and
 * scroll it into view. When `selectionLength` is given, the word is selected
 * rather than just pointed at.
 */
async function openAndReveal(fileName, row, column, selectionLength) {
    const editor = (await atom.workspace.open(fileName));
    if (selectionLength && selectionLength > 0) {
        editor.setSelectedBufferRange([
            [row, column],
            [row, column + selectionLength]
        ]);
    }
    else {
        editor.setCursorBufferPosition([row, column]);
    }
    editor.scrollToCursorPosition({ center: true });
    return editor;
}
/** The project-relative path, falling back to the absolute one. */
function relativize(fileName) {
    const [, relativePath] = atom.project.relativizePath(fileName);
    return relativePath || fileName;
}
/** Leading whitespace of the buffer row up to `column`. */
function leadingWhitespace(editor, row, column) {
    const text = editor.lineTextForBufferRow(row)?.slice(0, column) ?? '';
    return /^[ \t]*/.exec(text)?.[0] ?? '';
}
//# sourceMappingURL=editor-utils.js.map