import { describe, it, expect } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import * as main from '../src/main';
import packageJson from '../package.json';

const ROOT = join(__dirname, '..');

describe('package entry', () => {
  it('exports the lifecycle hooks Pulsar calls', () => {
    expect(typeof main.activate).toBe('function');
    expect(typeof main.deactivate).toBe('function');
    expect(typeof main.config).toBe('object');
  });

  it('exports every function named in providedServices', () => {
    for (const service of Object.values(packageJson.providedServices)) {
      for (const method of Object.values(service.versions)) {
        expect(typeof (main as Record<string, unknown>)[method]).toBe(
          'function'
        );
      }
    }
  });

  it('exports every function named in consumedServices', () => {
    for (const service of Object.values(packageJson.consumedServices)) {
      for (const method of Object.values(service.versions)) {
        expect(typeof (main as Record<string, unknown>)[method]).toBe(
          'function'
        );
      }
    }
  });

  it('deactivate is safe before activate and twice in a row', () => {
    expect(() => main.deactivate()).not.toThrow();
    expect(() => main.deactivate()).not.toThrow();
  });
});

describe('package manifest', () => {
  it('points main at the build output', () => {
    expect(packageJson.main).toBe('./dist/main.js');
  });

  it('activates only once a Python file is opened', () => {
    expect(packageJson.activationHooks).toContain(
      'source.python:root-scope-used'
    );
  });

  it('declares no dependency on the retired Kite or Atom packages', () => {
    const dependencies = Object.keys(packageJson.dependencies);
    for (const retired of [
      'kite-installer',
      'mixpanel',
      'space-pen',
      'atom-space-pen-views',
      'atom-slick',
      'selector-kit',
      'underscore'
    ]) {
      expect(dependencies).not.toContain(retired);
    }
  });

  it('ships the Python daemon the provider spawns', () => {
    expect(existsSync(join(ROOT, 'python', 'completion.py'))).toBe(true);
    expect(existsSync(join(ROOT, 'python', 'acp_jedi', '__init__.py'))).toBe(
      true
    );
  });
});
