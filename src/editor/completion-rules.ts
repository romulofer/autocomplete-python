/**
 * Decisions about when and what to complete.
 *
 * Pure predicates and filters, kept out of the provider so they can be tested
 * without an editor or a daemon.
 */

import { filter as fuzzyFilter } from 'fuzzaldrin-plus';
import type { Suggestion } from '../daemon/protocol';

/** Prefixes that ask for completions but carry no text to filter on. */
const TRIGGER_ONLY_PREFIXES = ['', ' ', '.', '('];

/**
 * Narrow suggestions to the ones matching `query`.
 *
 * Filtering on a bare trigger character would empty the list right after the
 * keystroke that asked for completions, so those prefixes pass everything
 * through.
 */
export function filterSuggestions(
  candidates: readonly Suggestion[],
  query: string
): Suggestion[] {
  const list = [...candidates];
  if (list.length === 0) return list;
  if (TRIGGER_ONLY_PREFIXES.includes(query)) return list;
  return fuzzyFilter(list, query, { key: 'text' });
}

/**
 * Whether arguments should be completed at `column` on `line`.
 *
 * Only right after a `(`, and only when nothing but whitespace or the closing
 * paren follows - arguments already typed must not be rewritten.
 */
export function isArgumentCompletionSite(
  line: string,
  column: number
): boolean {
  if (line.slice(column - 1, column) !== '(') return false;
  return /^(\)(?:$|\s)|\s|$)/.test(line.slice(column));
}

/**
 * Rewind the request position to just after the last dot so one Jedi lookup can
 * serve every keystroke of the same identifier, which is what makes the local
 * fuzzy matcher worthwhile.
 *
 * Returns `null` when there is no identifier to trim.
 */
export function truncateToIdentifierStart(
  line: string,
  column: number
): { column: number; line: string } | null {
  const lastIdentifier = /\.?[a-zA-Z_][a-zA-Z0-9_]*$/.exec(
    line.slice(0, column)
  );
  if (!lastIdentifier) return null;

  // Rewind past the dot when there is one; a bare identifier rewinds to its own
  // start. The old `index + 1` assumed the leading dot always matched, so a
  // dot-less identifier lost its first character.
  const hasLeadingDot = lastIdentifier[0].startsWith('.');
  const truncatedColumn = lastIdentifier.index + (hasLeadingDot ? 1 : 0);
  return { column: truncatedColumn, line: line.slice(0, truncatedColumn) };
}
