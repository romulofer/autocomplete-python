import type { CursorPositionChangedEvent, DisplayMarker, TextEditor } from 'atom';
import { parseSelectorList, scopesMatchSelectors } from '../editor/scope-helpers';
import * as log from '../log';
import type { Definition } from '../daemon/protocol';

/**
 * Scopes where a tooltip is noise rather than information: literals,
 * punctuation, keywords and the name being defined right now.
 */
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
    '.variable.parameter',
    '.entity.name'
  ].join(', ')
);

/** What the tooltip manager needs from the provider, kept narrow to avoid a cycle. */
export interface TooltipSource {
  getTooltip(editor: TextEditor, bufferPosition: { row: number; column: number }): Promise<Definition[]>;
}

/**
 * Shows the docstring of the symbol under the cursor as an editor overlay.
 * One marker at a time: the previous one is torn down before a new lookup
 * starts, and a lookup that finishes after its marker died is discarded.
 */
export class TooltipManager {
  private markers: DisplayMarker[] = [];

  constructor(private readonly source: TooltipSource) {}

  async handleCursorChange(
    editor: TextEditor,
    event: CursorPositionChangedEvent
  ): Promise<void> {
    this.clearMarkers();

    const cursor = event.cursor;
    const scopes = editor
      .scopeDescriptorForBufferPosition(event.newBufferPosition)
      .getScopesArray();
    if (scopesMatchSelectors(scopes, DISABLED_SELECTORS)) {
      log.debug('Not showing a tooltip inside', scopes);
      return;
    }

    const marker = editor.markBufferRange(cursor.getCurrentWordBufferRange(), {
      invalidate: 'never'
    });
    this.markers.push(marker);

    const results = await this.source.getTooltip(editor, event.newBufferPosition);
    if (marker.isDestroyed()) return;

    const description = results[0]?.description?.trim();
    if (!description) {
      marker.destroy();
      return;
    }

    const view = document.createElement('autocomplete-python-suggestion');
    view.textContent = description;
    editor.decorateMarker(marker, {
      type: 'overlay',
      item: view,
      position: 'head'
    });
  }

  clearMarkers(): void {
    for (const marker of this.markers) marker.destroy();
    this.markers = [];
  }

  dispose(): void {
    this.clearMarkers();
  }
}
