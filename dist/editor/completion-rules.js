"use strict";
/**
 * Decisions about when and what to complete.
 *
 * Pure predicates and filters, kept out of the provider so they can be tested
 * without an editor or a daemon.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterSuggestions = filterSuggestions;
exports.isArgumentCompletionSite = isArgumentCompletionSite;
exports.truncateToIdentifierStart = truncateToIdentifierStart;
const fuzzaldrin_plus_1 = require("fuzzaldrin-plus");
/** Prefixes that ask for completions but carry no text to filter on. */
const TRIGGER_ONLY_PREFIXES = ['', ' ', '.', '('];
/**
 * Narrow suggestions to the ones matching `query`.
 *
 * Filtering on a bare trigger character would empty the list right after the
 * keystroke that asked for completions, so those prefixes pass everything
 * through.
 */
function filterSuggestions(candidates, query) {
    const list = [...candidates];
    if (list.length === 0)
        return list;
    if (TRIGGER_ONLY_PREFIXES.includes(query))
        return list;
    return (0, fuzzaldrin_plus_1.filter)(list, query, { key: 'text' });
}
/**
 * Whether arguments should be completed at `column` on `line`.
 *
 * Only right after a `(`, and only when nothing but whitespace or the closing
 * paren follows - arguments already typed must not be rewritten.
 */
function isArgumentCompletionSite(line, column) {
    if (line.slice(column - 1, column) !== '(')
        return false;
    return /^(\)(?:$|\s)|\s|$)/.test(line.slice(column));
}
/**
 * Rewind the request position to just after the last dot so one Jedi lookup can
 * serve every keystroke of the same identifier, which is what makes the local
 * fuzzy matcher worthwhile.
 *
 * Returns `null` when there is no identifier to trim.
 */
function truncateToIdentifierStart(line, column) {
    const lastIdentifier = /\.?[a-zA-Z_][a-zA-Z0-9_]*$/.exec(line.slice(0, column));
    if (!lastIdentifier)
        return null;
    const truncatedColumn = lastIdentifier.index + 1;
    return { column: truncatedColumn, line: line.slice(0, truncatedColumn) };
}
//# sourceMappingURL=completion-rules.js.map