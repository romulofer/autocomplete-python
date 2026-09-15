/**
 * Package entry point.
 *
 * Activation is driven by the `source.python:root-scope-used` hook declared in
 * `package.json`, so nothing here runs until a Python file is actually opened.
 * This module stays thin: the settings schema lives in `src/config.ts` and every
 * behaviour lives behind {@link PythonProvider}.
 */

import type { TextEditor } from 'atom';
import provider, { PythonProvider } from './provider';
import hyperclickProvider from './hyperclick-provider';
import { configSchema } from './config';
import type { StatusBar } from './views/status-bar-view';

interface SnippetsManager {
  insertSnippet(snippet: string, editor: TextEditor): void;
}

export const config = configSchema;

export function activate(): void {
  provider.activate();
}

export function deactivate(): void {
  provider.dispose();
}

export function getProvider(): PythonProvider {
  return provider.activate();
}

export function getHyperclickProvider(): typeof hyperclickProvider {
  return hyperclickProvider;
}

export function consumeSnippets(snippetsManager: SnippetsManager): void {
  provider.setSnippetsManager(snippetsManager);
}

export function consumeStatusBar(statusBar: StatusBar): void {
  provider.activate().consumeStatusBar(statusBar);
}
