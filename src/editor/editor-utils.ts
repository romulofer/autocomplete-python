import type { TextEditor } from 'atom';

/**
 * Open `fileName`, put the cursor at `row`/`column` (both zero-based) and
 * scroll it into view. When `selectionLength` is given, the word is selected
 * rather than just pointed at.
 */
export async function openAndReveal(
  fileName: string,
  row: number,
  column: number,
  selectionLength?: number
): Promise<TextEditor> {
  const editor = (await atom.workspace.open(fileName)) as TextEditor;
  if (selectionLength && selectionLength > 0) {
    editor.setSelectedBufferRange([
      [row, column],
      [row, column + selectionLength]
    ]);
  } else {
    editor.setCursorBufferPosition([row, column]);
  }
  editor.scrollToCursorPosition({ center: true });
  return editor;
}

/** The project-relative path, falling back to the absolute one. */
export function relativize(fileName: string): string {
  const [, relativePath] = atom.project.relativizePath(fileName);
  return relativePath || fileName;
}

/** Leading whitespace of the buffer row up to `column`. */
export function leadingWhitespace(
  editor: TextEditor,
  row: number,
  column: number
): string {
  const text = editor.lineTextForBufferRow(row)?.slice(0, column) ?? '';
  return /^[ \t]*/.exec(text)?.[0] ?? '';
}
