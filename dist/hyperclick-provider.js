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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const provider_1 = __importDefault(require("./provider"));
const scope_helpers_1 = require("./editor/scope-helpers");
const log = __importStar(require("./log"));
/** Clicking a literal, a keyword or punctuation should do nothing. */
const DISABLED_SELECTORS = (0, scope_helpers_1.parseSelectorList)([
    '.comment',
    '.string',
    '.numeric',
    '.integer',
    '.decimal',
    '.punctuation',
    '.keyword',
    '.storage',
    '.variable.parameter'
].join(', '));
/**
 * Ctrl/Cmd-click support via the `hyperclick` package. Delegates to the same
 * go-to-definition path as the command.
 */
exports.default = {
    priority: 1,
    providerName: 'autocomplete-python-pulsar',
    getSuggestionForWord(editor, text, range) {
        if (text === '.' || text === ':')
            return undefined;
        if (!editor.getGrammar().scopeName.startsWith('source.python')) {
            return undefined;
        }
        const bufferPosition = range.start;
        const scopes = editor
            .scopeDescriptorForBufferPosition(bufferPosition)
            .getScopesArray();
        if ((0, scope_helpers_1.scopesMatchSelectors)(scopes, DISABLED_SELECTORS))
            return undefined;
        log.debug('Hyperclick target', text, scopes);
        return {
            range,
            callback: () => {
                void provider_1.default.activate().goToDefinition(editor, bufferPosition);
            }
        };
    }
};
//# sourceMappingURL=hyperclick-provider.js.map