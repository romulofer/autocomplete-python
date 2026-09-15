"use strict";
/**
 * Generating the body of an overridden method.
 *
 * Pure text in, pure text out: no editor involved, so the shape of the
 * generated code is covered by tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parameterCallName = parameterCallName;
exports.buildOverrideSnippet = buildOverrideSnippet;
/** `x: int = 3` -> `x`; `*args` and `**kwargs` pass through unchanged. */
function parameterCallName(description) {
    return (description.split(/[:=]/)[0] ?? '').trim();
}
/**
 * Build a `def`/`super()` pair for `method`.
 *
 * The `super()` call uses the Python 3 zero-argument form. The old
 * implementation emitted `super(Class, self)` with the class name guessed from
 * the completion's parent, which produced code naming the wrong class in nested
 * or multiply-inherited definitions. Upstream issue #186.
 */
function buildOverrideSnippet(method, { indent, tab }) {
    const signature = `def ${method.name}(${['self', ...method.params].join(', ')}):`;
    const callArguments = method.params
        .map(parameterCallName)
        .filter((name) => name.length > 0)
        .join(', ');
    const superCall = `super().${method.name}(${callArguments})`;
    // `__init__` returns nothing, so returning the super call would be wrong.
    const body = method.name === '__init__' ? superCall : `return ${superCall}`;
    return `${signature}\n${indent}${tab}${body}`;
}
//# sourceMappingURL=override.js.map