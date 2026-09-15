import { describe, it, expect } from 'bun:test';
import { filterSuggestions, isArgumentCompletionSite } from '../src/editor/completion-rules';
import type { Suggestion } from '../src/daemon/protocol';

const suggestion = (text: string): Suggestion => ({ text, type: 'function' });

describe('filterSuggestions', () => {
  const candidates = [
    suggestion('stderr'),
    suggestion('stdout'),
    suggestion('setrecursionlimit')
  ];

  it('narrows candidates by a fuzzy match', () => {
    const found = filterSuggestions(candidates, 'stdr').map((s) => s.text);
    expect(found).toContain('stderr');
    expect(found).not.toContain('setrecursionlimit');
  });

  it('keeps everything for a trigger character', () => {
    // Filtering on `.` or `(` would empty the list right after the character
    // that asked for completions in the first place.
    for (const trigger of ['.', ' ', '(', '']) {
      expect(filterSuggestions(candidates, trigger)).toHaveLength(3);
    }
  });

  it('returns an empty list unchanged', () => {
    expect(filterSuggestions([], 'anything')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const original = [...candidates];
    filterSuggestions(candidates, 'std');
    expect(candidates).toEqual(original);
  });
});

describe('isArgumentCompletionSite', () => {
  it('accepts a cursor just after an open paren', () => {
    expect(isArgumentCompletionSite('foo(', 4)).toBe(true);
    expect(isArgumentCompletionSite('foo()', 4)).toBe(true);
    expect(isArgumentCompletionSite('foo(  ', 4)).toBe(true);
  });

  it('rejects a cursor that is not after an open paren', () => {
    expect(isArgumentCompletionSite('foo(', 3)).toBe(false);
    expect(isArgumentCompletionSite('foo', 3)).toBe(false);
    expect(isArgumentCompletionSite('', 0)).toBe(false);
  });

  it('refuses to rewrite arguments that are already there', () => {
    expect(isArgumentCompletionSite('foo(x)', 4)).toBe(false);
    expect(isArgumentCompletionSite('foo(bar(), 1)', 4)).toBe(false);
  });

  it('allows a trailing close paren followed by more code', () => {
    expect(isArgumentCompletionSite('print(foo(', 10)).toBe(true);
    expect(isArgumentCompletionSite('x = foo() ', 9)).toBe(false);
  });
});
