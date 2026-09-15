import { SelectListPanel, twoLineListItem } from './select-list-panel';
import { openAndReveal, relativize } from '../editor/editor-utils';
import type { Definition } from '../daemon/protocol';

/** The picker shown by `autocomplete-python:go-to-definition`. */
export function createDefinitionsView(): SelectListPanel<Definition> {
  return new SelectListPanel<Definition>({
    loadingMessage: 'Looking for definitions…',
    emptyMessage: 'No definition found',
    filterKeyForItem: (definition) =>
      `${definition.text} ${relativize(definition.fileName)}`,
    elementForItem: (definition) =>
      twoLineListItem(
        `${definition.type} ${definition.text}`,
        `${relativize(definition.fileName)}, line ${definition.line + 1}`
      ),
    didConfirmSelection: (definition) => {
      void openAndReveal(definition.fileName, definition.line, definition.column);
    }
  });
}
