import { SelectListPanel, twoLineListItem } from './select-list-panel';
import {
  SOURCE_LABELS,
  type DiscoveredInterpreter
} from '../interpreters/locators';

/**
 * The interpreter picker, modelled on the VS Code Python extension's
 * "Select Interpreter" quick pick: one row per discovered interpreter, labelled
 * with the environment it belongs to and the locator that found it.
 */
export function createInterpreterView(
  onConfirm: (interpreter: DiscoveredInterpreter) => void
): SelectListPanel<DiscoveredInterpreter> {
  return new SelectListPanel<DiscoveredInterpreter>({
    loadingMessage: 'Looking for Python interpreters…',
    emptyMessage: 'No Python interpreter found',
    filterKeyForItem: (interpreter) =>
      `${interpreter.environmentName ?? ''} ${interpreter.filePath}`,
    elementForItem: (interpreter) =>
      twoLineListItem(
        interpreter.environmentName
          ? `${interpreter.environmentName} (${SOURCE_LABELS[interpreter.source]})`
          : SOURCE_LABELS[interpreter.source],
        interpreter.filePath
      ),
    didConfirmSelection: onConfirm
  });
}
