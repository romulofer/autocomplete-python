# Architecture

Two processes. Pulsar runs the TypeScript side; a Python daemon runs Jedi. They
talk over newline-delimited JSON on the daemon's stdin/stdout.

```
┌─ Pulsar (Electron) ──────────────┐        ┌─ python3 ─────────────────┐
│ main.ts                          │        │ python/completion.py      │
│   └─ provider.ts                 │        │   └─ acp_jedi/            │
│        ├─ interpreters/  ────────┼── spawn┤        daemon → session   │
│        ├─ daemon/jedi-daemon.ts ◄┼── JSON ┼──►     → serializers      │
│        ├─ editor/                │        │        → names → jedi     │
│        └─ views/                 │        └───────────────────────────┘
└──────────────────────────────────┘
```

## Layering rule

The package is split so that the logic worth testing never touches Pulsar or the
filesystem directly.

- **Pure modules** take their inputs as parameters: `config.ts`,
  `interpreters/locators.ts`, `editor/*`, and the top half of
  `daemon/protocol.ts`. These are covered by `test/`.
- **Edge modules** own the I/O: `host/atom-host.ts` (the `atom` global, `fs`,
  `process.env`), `daemon/process.ts` (`BufferedProcess`), and `views/`.
- **`provider.ts`** wires the two together. It is the only module that both
  reads editor state and calls the daemon.

`host/types.ts` declares the narrow interfaces the edge implements, which is why
interpreter discovery can be exercised against a fake filesystem.

## TypeScript modules

| Module | Responsibility |
| --- | --- |
| `main.ts` | Package entry point: lifecycle hooks and service getters. Thin. |
| `config.ts` | The settings schema, plus pure parsing/defaulting of raw config. |
| `provider.ts` | The autocomplete-plus provider, commands, and editor observers. |
| `hyperclick-provider.ts` | Ctrl/Cmd-click support, delegating to go-to-definition. |
| `log.ts` | Debug/warning/error logging behind the `outputDebug` setting. |
| `host/types.ts` | Interfaces for the filesystem, environment and notifications. |
| `host/atom-host.ts` | The real implementations. The only importer of `fs`/`atom`. |
| `interpreters/locators.ts` | Where Python interpreters live, and in what order. |
| `interpreters/registry.ts` | Caching in front of discovery. |
| `daemon/protocol.ts` | Wire types, request ids, line framing, response parsing. |
| `daemon/process.ts` | The child-process seam, so the daemon can be faked. |
| `daemon/jedi-daemon.ts` | Spawning, request/response bookkeeping, response cache. |
| `editor/scope-helpers.ts` | "Am I inside a comment or a string?" |
| `editor/completion-rules.ts` | When to complete, and how to filter results. |
| `editor/override.ts` | Generating an override stub. |
| `editor/editor-utils.ts` | Small editor helpers (open-and-reveal, indentation). |
| `run/command.ts` | Building the command line for "run this file". Pure. |
| `run/runner.ts` | Run lifecycle: start, stream, stop, exit. Spawn injected. |
| `run/spawn.ts` | The real `child_process` adapter. |
| `views/*` | Modal pickers, the rename prompt, tooltips, the status bar tile. |

## Python package

`python/completion.py` is a stub that puts its own directory on `sys.path` and
calls into `acp_jedi`:

| Module | Responsibility |
| --- | --- |
| `protocol.py` | The JSON wire format. Imports nothing from Jedi. |
| `runtime.py` | Version gates and the Jedi import, with reportable failures. |
| `names.py` | Duck-typed readers for Jedi `Name`/`Signature` objects. |
| `serializers.py` | Jedi results in, JSON-ready data out. |
| `session.py` | One request: config, `sys.path`, `Script`, dispatch. |
| `daemon.py` | The stdin/stdout loop and the command-line entry point. |

Only `session.py` and `runtime.py` know Jedi exists; `names.py` and
`serializers.py` work against whatever objects they are handed, which is what
lets the tests drive them with stand-ins.

## The protocol

Every request is one JSON object on one line:

```json
{
  "id": "<sha256>",
  "lookup": "completions",
  "path": "/work/app.py",
  "source": "import os\nos.",
  "line": 1,
  "column": 3,
  "prefix": ".",
  "config": { "extraPaths": [], "useSnippets": "none", "fuzzyMatcher": true,
              "showDescriptions": true, "caseInsensitiveCompletion": true }
}
```

The response echoes the `id`:

```json
{ "id": "<sha256>", "results": [ { "text": "path", "type": "import" } ] }
```

Notable details:

- **`id` is a SHA-256 of everything that can change the answer** (path, source,
  row, column, lookup). That makes it both the correlation key and the response
  cache key: an identical request is answered from cache without a round trip.
- **Rows are zero-based on the wire**, as Pulsar reports them. `session.py`
  converts to Jedi's one-based lines. Results follow whichever convention the
  consumer needs: definitions come back zero-based (ready for
  `setCursorBufferPosition`), usages stay one-based (as Jedi reports them).
- **Two reserved ids.** `__ready__` is the handshake, written once at startup
  with the Python and Jedi versions. `__error__` reports a failure that stops
  the daemon from starting, so a missing Jedi becomes an actionable notification
  rather than a traceback on stderr.
- **stdout is muted while a request runs.** Anything a project module prints on
  import goes to `os.devnull`; responses are written to `sys.__stdout__`
  directly. A line that still fails to parse is logged and skipped rather than
  throwing.
- **Chunks are reassembled.** `LineFramer` buffers stdout until a newline
  arrives, because a chunk boundary has nothing to do with a message boundary.

## Lifecycle

1. Pulsar activates the package on the `source.python:root-scope-used` hook, so
   nothing runs until a Python file is opened.
2. `provider.activate()` registers commands, observes editors, and compiles the
   trigger regex.
3. The first request spawns the daemon with the discovered interpreter.
4. The daemon shuts down after `daemonIdleTimeout` minutes without a request and
   respawns on the next one.
5. Changing an interpreter-affecting setting invalidates the discovery cache,
   clears the response cache, and restarts the daemon.

## Testing

- `test/`: Bun tests for the TypeScript side. Interpreter discovery runs
  against an in-memory filesystem (`test/helpers/fake-host.ts`); the daemon runs
  against an injected fake process.
- `python/tests/`: pytest. Most tests use the stand-ins in `conftest.py`;
  `test_integration.py` spawns the real daemon against a real Jedi.

`npm test` runs the typecheck and both suites.
