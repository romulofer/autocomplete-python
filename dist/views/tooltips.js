"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TooltipManager = void 0;
const scope_helpers_1 = require("../editor/scope-helpers");
const log = __importStar(require("../log"));
/**
 * Scopes where a tooltip is noise rather than information: literals,
 * punctuation, keywords and the name being defined right now.
 */
const DISABLED_SELECTORS = (0, scope_helpers_1.parseSelectorList)([
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
].join(', '));
/**
 * Shows the docstring of the symbol under the cursor as an editor overlay.
 * One marker at a time: the previous one is torn down before a new lookup
 * starts, and a lookup that finishes after its marker died is discarded.
 */
class TooltipManager {
    source;
    markers = [];
    constructor(source) {
        this.source = source;
    }
    async handleCursorChange(editor, event) {
        this.clearMarkers();
        const cursor = event.cursor;
        const scopes = editor
            .scopeDescriptorForBufferPosition(event.newBufferPosition)
            .getScopesArray();
        if ((0, scope_helpers_1.scopesMatchSelectors)(scopes, DISABLED_SELECTORS)) {
            log.debug('Not showing a tooltip inside', scopes);
            return;
        }
        const marker = editor.markBufferRange(cursor.getCurrentWordBufferRange(), {
            invalidate: 'never'
        });
        this.markers.push(marker);
        const results = await this.source.getTooltip(editor, event.newBufferPosition);
        if (marker.isDestroyed())
            return;
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
    clearMarkers() {
        for (const marker of this.markers)
            marker.destroy();
        this.markers = [];
    }
    dispose() {
        this.clearMarkers();
    }
}
exports.TooltipManager = TooltipManager;
//# sourceMappingURL=tooltips.js.map