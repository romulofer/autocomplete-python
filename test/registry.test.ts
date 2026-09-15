import { describe, it, expect } from 'bun:test';
import { InterpreterRegistry } from '../src/interpreters/registry';
import { fakeHost } from './helpers/fake-host';
import type { DiscoveryOptions } from '../src/interpreters/locators';

describe('InterpreterRegistry', () => {
  const tree = {
    executables: ['/usr/bin/python3', '/opt/other/bin/python3']
  };

  it('returns the highest-priority interpreter', () => {
    const host = fakeHost(tree, { pathEntries: ['/usr/bin'] });
    const registry = new InterpreterRegistry(host, () => ({}));

    expect(registry.bestPath()).toBe('/usr/bin/python3');
    expect(registry.best()?.source).toBe('path');
  });

  it('returns null when nothing was found', () => {
    const registry = new InterpreterRegistry(fakeHost({}), () => ({}));
    expect(registry.best()).toBeNull();
    expect(registry.bestPath()).toBeNull();
  });

  it('reads the options once and caches the result', () => {
    let reads = 0;
    const registry = new InterpreterRegistry(
      fakeHost(tree, { pathEntries: ['/usr/bin'] }),
      (): DiscoveryOptions => {
        reads += 1;
        return {};
      }
    );

    registry.all();
    registry.all();
    registry.bestPath();
    expect(reads).toBe(1);
  });

  it('re-reads the options after invalidation', () => {
    let selected = '';
    const registry = new InterpreterRegistry(
      fakeHost(tree, { pathEntries: ['/usr/bin'] }),
      () => ({ selected })
    );

    expect(registry.bestPath()).toBe('/usr/bin/python3');

    selected = '/opt/other/bin/python3';
    expect(registry.bestPath()).toBe('/usr/bin/python3');

    registry.invalidate();
    expect(registry.bestPath()).toBe('/opt/other/bin/python3');
    expect(registry.best()?.source).toBe('selected');
  });

  it('describes an interpreter by environment name, else by file name', () => {
    const host = fakeHost({
      executables: ['/work/app/.venv/bin/python3', '/usr/bin/python3'],
      files: { '/work/app/.venv/pyvenv.cfg': '' }
    });
    const registry = new InterpreterRegistry(host, () => ({}));

    expect(
      registry.describe({
        filePath: '/work/app/.venv/bin/python3',
        source: 'workspace',
        environmentName: '.venv'
      })
    ).toBe('.venv');

    expect(
      registry.describe({
        filePath: '/usr/bin/python3',
        source: 'path',
        environmentName: null
      })
    ).toBe('python3');
  });
});
