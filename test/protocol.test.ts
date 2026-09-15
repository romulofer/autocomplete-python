import { describe, it, expect } from 'bun:test';
import {
  emptyResponse,
  FATAL_ERROR_ID,
  generateRequestId,
  HANDSHAKE_ID,
  LineFramer,
  parseResponseLine
} from '../src/daemon/protocol';

describe('generateRequestId', () => {
  const id = (): string =>
    generateRequestId('completions', '/a.py', 'import os', 1, 2);

  it('is stable for identical inputs', () => {
    expect(id()).toBe(id());
  });

  // Upstream issue #432: MD5 is unavailable when OpenSSL runs in FIPS mode,
  // which used to break the package outright.
  it('is a sha256 digest, not md5', () => {
    expect(id()).toHaveLength(64);
    expect(id()).toMatch(/^[0-9a-f]+$/);
  });

  it('changes when any input changes', () => {
    const variants = new Set([
      generateRequestId('completions', '/a.py', 'import os', 1, 2),
      generateRequestId('definitions', '/a.py', 'import os', 1, 2),
      generateRequestId('completions', '/b.py', 'import os', 1, 2),
      generateRequestId('completions', '/a.py', 'import sys', 1, 2),
      generateRequestId('completions', '/a.py', 'import os', 9, 2),
      generateRequestId('completions', '/a.py', 'import os', 1, 9)
    ]);
    expect(variants.size).toBe(6);
  });

  it('treats an unsaved buffer as its own key', () => {
    expect(generateRequestId('completions', null, 'x', 0, 0)).not.toBe(
      generateRequestId('completions', '/x.py', 'x', 0, 0)
    );
  });
});

describe('LineFramer', () => {
  it('returns complete lines and holds back the partial tail', () => {
    const framer = new LineFramer();
    expect(framer.push('{"a":1}\n{"b":')).toEqual(['{"a":1}']);
    expect(framer.pending).toBe('{"b":');
    expect(framer.push('2}\n')).toEqual(['{"b":2}']);
    expect(framer.pending).toBe('');
  });

  // Upstream issues #354, #366: chunk boundaries have nothing to do with
  // message boundaries, and the old code parsed each chunk as it arrived.
  it('reassembles a message split across many chunks', () => {
    const framer = new LineFramer();
    const message = '{"id":"x","results":[]}';
    for (const character of message) {
      expect(framer.push(character)).toEqual([]);
    }
    expect(framer.push('\n')).toEqual([message]);
  });

  it('returns several messages arriving in one chunk', () => {
    const framer = new LineFramer();
    expect(framer.push('one\ntwo\nthree\n')).toEqual(['one', 'two', 'three']);
  });

  it('skips blank lines', () => {
    expect(new LineFramer().push('\n\n  \nvalue\n')).toEqual(['value']);
  });

  it('drops the buffered tail on reset', () => {
    const framer = new LineFramer();
    framer.push('partial');
    framer.reset();
    expect(framer.pending).toBe('');
    expect(framer.push('\n')).toEqual([]);
  });
});

describe('parseResponseLine', () => {
  it('parses a well-formed response', () => {
    expect(parseResponseLine('{"id":"abc","results":[1]}')).toEqual({
      id: 'abc',
      results: [1]
    } as never);
  });

  it('returns null for output that is not JSON', () => {
    // A project module printing a banner on import must not break the stream.
    expect(parseResponseLine('Loading plugin...')).toBeNull();
    expect(parseResponseLine('us-ascii')).toBeNull();
    expect(parseResponseLine('{"unterminated":')).toBeNull();
  });

  it('returns null for JSON without a string id', () => {
    expect(parseResponseLine('{"results":[]}')).toBeNull();
    expect(parseResponseLine('[1,2,3]')).toBeNull();
    expect(parseResponseLine('null')).toBeNull();
  });

  it('recognises the reserved ids', () => {
    const handshake = parseResponseLine(
      `{"id":"${HANDSHAKE_ID}","results":[],"python":"3.12.4","jedi":"0.19.2"}`
    );
    expect(handshake?.id).toBe(HANDSHAKE_ID);

    const fatal = parseResponseLine(
      `{"id":"${FATAL_ERROR_ID}","results":[],"error":"jedi-missing"}`
    );
    expect(fatal?.id).toBe(FATAL_ERROR_ID);
  });
});

describe('emptyResponse', () => {
  it('keeps the id so the caller can still correlate it', () => {
    expect(emptyResponse('abc')).toEqual({ id: 'abc', results: [] });
  });
});
