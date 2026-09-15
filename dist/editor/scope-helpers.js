"use strict";
// Minimal scope matching for the "don't complete here" checks.
//
// Historically this package parsed `disableForSelector` with a full CSS
// selector engine (atom-slick + selector-kit). Every selector it has ever used
// looks like `.source.python .something`, and the package only runs inside a
// Python editor, so the `.source.python` ancestor is always satisfied. That
// reduces the problem to "does any scope under the cursor carry all of these
// dot-separated segments?", which needs no dependencies.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSelectorList = parseSelectorList;
exports.scopeMatchesSegments = scopeMatchesSegments;
exports.scopesMatchSelectors = scopesMatchSelectors;
/**
 * Turn a selector list such as `.source.python .comment, .source.python .string`
 * into `[['comment'], ['string']]`: the required scope segments of each
 * comma-separated selector, taken from its right-most compound selector.
 */
function parseSelectorList(selectorList) {
    return selectorList
        .split(',')
        .map((selector) => selector.trim())
        .filter((selector) => selector.length > 0)
        .map((selector) => {
        const compounds = selector.split(/\s+/);
        const rightMost = compounds[compounds.length - 1] ?? '';
        return rightMost.split('.').filter((segment) => segment.length > 0);
    })
        .filter((segments) => segments.length > 0);
}
/**
 * A scope matches when it carries every required segment, the same way a CSS
 * class selector requires every listed class to be present on the element.
 *
 * @param scope e.g. `constant.numeric.integer.python`
 * @param requiredSegments e.g. `['numeric']`
 */
function scopeMatchesSegments(scope, requiredSegments) {
    const segments = scope.split('.');
    return requiredSegments.every((required) => segments.includes(required));
}
/**
 * @param scopesArray from `scopeDescriptor.getScopesArray()`
 * @param parsedSelectors from {@link parseSelectorList}
 */
function scopesMatchSelectors(scopesArray, parsedSelectors) {
    return scopesArray.some((scope) => parsedSelectors.some((segments) => scopeMatchesSegments(scope, segments)));
}
//# sourceMappingURL=scope-helpers.js.map