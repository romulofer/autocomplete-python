import type { TextEditor } from 'atom';
import { SelectListPanel, twoLineListItem } from './select-list-panel';
import { leadingWhitespace, relativize } from '../editor/editor-utils';
import { buildOverrideSnippet } from '../editor/override';
import type { MethodDefinition } from '../daemon/protocol';

/** Write the override stub at the given position. */
export function insertOverride(
  editor: TextEditor,
  method: MethodDefinition,
  row: number,
  column: number
): void {
  const snippet = buildOverrideSnippet(method, {
    indent: leadingWhitespace(editor, row, column),
    tab: editor.getTabText()
  });

  editor.setCursorBufferPosition([row, column]);
  editor.insertText(snippet, {
    autoIndent: false,
    autoIndentNewline: false
  });
}

/** The picker shown by `autocomplete-python:override-method`. */
export function createOverrideView(
  onConfirm: (method: MethodDefinition) => void
): SelectListPanel<MethodDefinition> {
  return new SelectListPanel<MethodDefinition>({
    loadingMessage: 'Looking for methods…',
    emptyMessage: 'No methods found',
    filterKeyForItem: (method) => `${method.parent}.${method.name}`,
    elementForItem: (method) =>
      twoLineListItem(
        `${method.parent}.${method.name}`,
        method.line && method.fileName
          ? `${relativize(method.fileName)}, line ${method.line}`
          : 'builtin'
      ),
    didConfirmSelection: onConfirm
  });
}
