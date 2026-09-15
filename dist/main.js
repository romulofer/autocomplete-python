"use strict";
/**
 * Package entry point.
 *
 * Activation is driven by the `source.python:root-scope-used` hook declared in
 * `package.json`, so nothing here runs until a Python file is actually opened.
 * This module stays thin: the settings schema lives in `src/config.ts` and every
 * behaviour lives behind {@link PythonProvider}.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
exports.getProvider = getProvider;
exports.getHyperclickProvider = getHyperclickProvider;
exports.consumeSnippets = consumeSnippets;
exports.consumeStatusBar = consumeStatusBar;
const provider_1 = __importDefault(require("./provider"));
const hyperclick_provider_1 = __importDefault(require("./hyperclick-provider"));
const config_1 = require("./config");
exports.config = config_1.configSchema;
function activate() {
    provider_1.default.activate();
}
function deactivate() {
    provider_1.default.dispose();
}
function getProvider() {
    return provider_1.default.activate();
}
function getHyperclickProvider() {
    return hyperclick_provider_1.default;
}
function consumeSnippets(snippetsManager) {
    provider_1.default.setSnippetsManager(snippetsManager);
}
function consumeStatusBar(statusBar) {
    provider_1.default.activate().consumeStatusBar(statusBar);
}
//# sourceMappingURL=main.js.map