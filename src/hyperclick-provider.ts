import type { Range, TextEditor } from 'atom';
import provider from './provider';
import { parseSelectorList, scopesMatchSelectors } from './editor/scope-helpers';
import * as log from './log';

/** Clicking a literal, a keyword or punctuation should do nothing. */
const DISABLED_SELECTORS = parseSelectorList(
  [
    '.comment',
    '.string',
    '.numeric',
    '.integer',
    '.decimal',
    '.punctuation',
    '.keyword',
    '.storage',
    '.variable.parameter'
  ].join(', ')
);

interface HyperclickSuggestion {
  range: Range;
  callback: () => void;
}

/**
 * Ctrl/Cmd-click support via the `hyperclick` package. Delegates to the same
 * go-to-definition path as the command.
 */
export default {
  priority: 1,
  providerName: 'autocomplete-python-pulsar',

  getSuggestionForWord(
    editor: TextEditor,
    text: string,
    range: Range
  ): HyperclickSuggestion | undefined {
    if (text === '.' || text === ':') return undefined;
    if (!editor.getGrammar().scopeName.startsWith('source.python')) {
      return undefined;
    }

    const bufferPosition = range.start;
    const scopes = editor
      .scopeDescriptorForBufferPosition(bufferPosition)
      .getScopesArray();
    if (scopesMatchSelectors(scopes, DISABLED_SELECTORS)) return undefined;

    log.debug('Hyperclick target', text, scopes);
    return {
      range,
      callback: () => {
        void provider.activate().goToDefinition(editor, bufferPosition);
      }
    };
  }
};
