import { SelectListPanel, twoLineListItem } from './select-list-panel';
import { openAndReveal, relativize } from '../editor/editor-utils';
import type { Usage } from '../daemon/protocol';

/**
 * The picker shown by `autocomplete-python:show-usages`.
 *
 * Jedi reports usages with one-based lines, so every buffer position derived
 * from a usage subtracts one.
 */
export function createUsagesView(): SelectListPanel<Usage> {
  return new SelectListPanel<Usage>({
    loadingMessage: 'Looking for usages…',
    emptyMessage: 'No usages found',
    filterKeyForItem: (usage) => `${usage.name} ${relativize(usage.fileName)}`,
    elementForItem: (usage) =>
      twoLineListItem(
        usage.name,
        `${relativize(usage.fileName)}, line ${usage.line}`
      ),
    // Preview the highlighted usage in the editor behind the panel, but only
    // when it is already the active one - opening a file per arrow key press
    // would be far too eager.
    didChangeSelection: (usage) => {
      if (!usage) return;
      const editor = atom.workspace.getActiveTextEditor();
      if (!editor || editor.getPath() !== usage.fileName) return;
      editor.setSelectedBufferRange([
        [usage.line - 1, usage.column],
        [usage.line - 1, usage.column + usage.name.length]
      ]);
      editor.scrollToBufferPosition([usage.line - 1, usage.column], {
        center: true
      });
    },
    didConfirmSelection: (usage) => {
      void openAndReveal(
        usage.fileName,
        usage.line - 1,
        usage.column,
        usage.name.length
      );
    }
  });
}
