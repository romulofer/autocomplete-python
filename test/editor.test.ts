import { describe, it, expect } from 'bun:test';
import {
  buildOverrideSnippet,
  parameterCallName
} from '../src/editor/override';
import {
  parseSelectorList,
  scopeMatchesSegments,
  scopesMatchSelectors
} from '../src/editor/scope-helpers';
import type { MethodDefinition } from '../src/daemon/protocol';

function method(overrides: Partial<MethodDefinition> = {}): MethodDefinition {
  return {
    parent: 'Base',
    instance: 'Child',
    name: 'run',
    params: [],
    moduleName: 'base',
    fileName: '/work/base.py',
    line: 4,
    column: 4,
    ...overrides
  };
}

describe('parameterCallName', () => {
  it('strips annotations and defaults', () => {
    expect(parameterCallName('x')).toBe('x');
    expect(parameterCallName('x: int')).toBe('x');
    expect(parameterCallName('x: int = 3')).toBe('x');
    expect(parameterCallName('y="Y"')).toBe('y');
  });

  it('passes star arguments through unchanged', () => {
    expect(parameterCallName('*args')).toBe('*args');
    expect(parameterCallName('**kwargs')).toBe('**kwargs');
  });
});

describe('buildOverrideSnippet', () => {
  const options = { indent: '    ', tab: '    ' };

  // Upstream issue #186: the old code emitted `super(Class, self)` with the
  // class name guessed from the completion's parent.
  it('uses the zero-argument super() form', () => {
    expect(buildOverrideSnippet(method(), options)).toBe(
      'def run(self):\n        return super().run()'
    );
  });

  it('forwards parameters without their annotations or defaults', () => {
    expect(
      buildOverrideSnippet(
        method({ params: ['x: int', 'y="Y"', '*args'] }),
        options
      )
    ).toBe(
      'def run(self, x: int, y="Y", *args):\n        return super().run(x, y, *args)'
    );
  });

  it('does not return from __init__', () => {
    expect(
      buildOverrideSnippet(method({ name: '__init__', params: ['x'] }), options)
    ).toBe('def __init__(self, x):\n        super().__init__(x)');
  });

  it('indents the body relative to the signature', () => {
    expect(
      buildOverrideSnippet(method(), { indent: '  ', tab: '\t' })
    ).toBe('def run(self):\n  \treturn super().run()');
  });
});

describe('parseSelectorList', () => {
  it('reduces each selector to its right-most compound', () => {
    expect(
      parseSelectorList('.source.python .comment, .source.python .string')
    ).toEqual([['comment'], ['string']]);
  });

  it('keeps every segment of a compound selector', () => {
    expect(parseSelectorList('.source.python .variable.parameter')).toEqual([
      ['variable', 'parameter']
    ]);
  });

  it('ignores empty entries', () => {
    expect(parseSelectorList(' , .comment ,, ')).toEqual([['comment']]);
    expect(parseSelectorList('')).toEqual([]);
  });
});

describe('scopeMatchesSegments', () => {
  it('matches a segment anywhere in the scope', () => {
    expect(
      scopeMatchesSegments('constant.numeric.integer.python', ['numeric'])
    ).toBe(true);
  });

  it('requires every listed segment, like a CSS class selector', () => {
    expect(
      scopeMatchesSegments('variable.parameter.python', [
        'variable',
        'parameter'
      ])
    ).toBe(true);
    expect(
      scopeMatchesSegments('variable.other.python', ['variable', 'parameter'])
    ).toBe(false);
  });

  it('does not match a partial segment', () => {
    expect(scopeMatchesSegments('commentary.python', ['comment'])).toBe(false);
  });
});

describe('scopesMatchSelectors', () => {
  const disabled = parseSelectorList(
    '.source.python .comment, .source.python .string'
  );

  it('suppresses completions inside comments and strings', () => {
    expect(
      scopesMatchSelectors(
        ['source.python', 'comment.line.number-sign.python'],
        disabled
      )
    ).toBe(true);
    expect(
      scopesMatchSelectors(
        ['source.python', 'string.quoted.single.python'],
        disabled
      )
    ).toBe(true);
  });

  it('allows completions in ordinary code', () => {
    expect(
      scopesMatchSelectors(['source.python', 'meta.function-call.python'], disabled)
    ).toBe(false);
    expect(scopesMatchSelectors([], disabled)).toBe(false);
  });
});
