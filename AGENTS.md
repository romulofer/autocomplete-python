# AGENTS.md - autocomplete-python

Guidance for AI agents working in this repository. Read this before touching code.

## Agent Policy (MUST FOLLOW)

- **Never author or co-author commits.** Do not set yourself as git
  author/committer, and never add a `Co-Authored-By` trailer naming any AI.
  Commits are authored by Rômulo Fernandes Evangelista only.
- **Never commit or push on your own initiative.** Only commit or push when the
  user explicitly asks for it *in that moment*. A prior "yes" is not standing
  authorization for the rest of the session.
- **Never publish.** `ppm publish` is public and irreversible. It bumps the
  version, creates a git tag, pushes, and uploads to the Pulsar registry. Do it
  only on an explicit, in-the-moment instruction, and say what version you are
  about to publish first.
- Do not open pull requests, create or delete remote branches, or otherwise
  mutate remote state without explicit instruction.
- Local git operations (status, diff, log, add, and a local commit when
  explicitly requested) are fine within the above constraints.
- Do not use em dashes in written prose (commit messages, docs, comments). Use a
  comma, colon, or period instead.

## Project Overview

Pulsar package providing Python IDE features powered by
[Jedi](https://github.com/davidhalter/jedi): completions, go-to-definition,
find-usages, project-wide rename, method override, argument snippets and
docstring tooltips.

Version 2.0 is a rewrite of the original Atom package. The Kite integration and
its telemetry are gone, CoffeeScript became TypeScript, and the Python backend
targets Jedi 0.19+ on Python 3.10+. Upstream
(`autocomplete-python/autocomplete-python`) is unmaintained and Atom is
discontinued; this fork is the active line of work.

## Tech Stack

| Category | Technology | Notes |
|---|---|---|
| Language | TypeScript 7 | `src/*.ts` compiled to `dist/*.js`, CommonJS, `module: node16` |
| Backend | Python 3.10+, Jedi 0.19+ | `python/completion.py` plus the `acp_jedi` package |
| UI | plain DOM + `atom-select-list` | not etch, not React, not jQuery |
| TS tests | `bun test` | `test/`, with `test/setup.ts` preloaded via `bunfig.toml` |
| Python tests | `pytest` | `python/tests/`, configured by `pytest.ini` |

Runtime dependencies are deliberately minimal: `atom-select-list` and
`fuzzaldrin-plus`. Do not add more without a strong reason.

## Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. The short version:

```
src/
├── main.ts            package entry point; thin, only lifecycle + service getters
├── config.ts          settings schema + pure parsing/defaulting
├── provider.ts        autocomplete-plus provider, commands, editor observers
├── host/              the ONLY modules allowed to touch `atom`, `fs`, `process.env`
├── interpreters/      where Python lives (pure locators + a caching registry)
├── daemon/            wire protocol (pure), process seam, the daemon itself
├── editor/            pure editor logic: scopes, completion rules, override text
└── views/             modal pickers, rename prompt, tooltips, status bar tile

python/
├── completion.py      entry stub: puts its own dir on sys.path, calls acp_jedi
└── acp_jedi/          protocol, runtime, names, serializers, session, daemon
```

### The layering rule (the important one)

Logic worth testing must not reach for globals. Pure modules take their inputs as
parameters; `host/types.ts` declares the interfaces, `host/atom-host.ts`
implements them.

When adding code, ask where it belongs:

- Needs `atom`, `fs`, or `process.env`? It goes in `host/` or `views/`, or it
  takes a `DiscoveryHost`/`Notifier` parameter.
- Pure decision or transformation? It goes in `config.ts`, `editor/`,
  `interpreters/locators.ts`, or `daemon/protocol.ts`, and it gets a test.

Do not import `atom` into `config.ts`, `editor/*`, `interpreters/locators.ts`, or
`daemon/protocol.ts`. That boundary is what makes the suites run without an
editor.

On the Python side, only `session.py` and `runtime.py` know Jedi exists.
`names.py` and `serializers.py` are duck-typed against whatever they are handed.
Keep it that way.

## Commands

```bash
npm install          # TypeScript toolchain
npm run build        # src/*.ts -> dist/   (REQUIRED before committing a src change)
npm run watch        # incremental build
npm run typecheck    # tsc --noEmit
npm run test:ts      # bun test
npm run test:py      # python3 -m pytest
npm test             # typecheck + both suites; run this before saying you are done
```

`python -m pip install -r python/requirements-dev.txt` installs `jedi` and
`pytest`.

## Gotchas

- **`dist/` is committed on purpose.** `ppm` installs the git tag as-is and does
  not run a build, and `package.json` `main` points into `dist/`. If you change
  `src/` and do not run `npm run build`, the published package ships stale code.
- **`python/` is not compiled and not bundled.** `provider.ts` resolves it as
  `path.resolve(__dirname, '..', 'python', 'completion.py')`, which depends on
  `dist/` being exactly one level below the package root. Do not change `outDir`
  without fixing that path.
- **Responses are written to `sys.__stdout__`, not `sys.stdout`.** `sys.stdout`
  is redirected to `os.devnull` while a request runs so that a project module
  printing on import cannot corrupt the response stream. In pytest this means
  `capfd`, not `capsys`.
- **Request ids are SHA-256, not MD5.** MD5 is unavailable under FIPS-mode
  OpenSSL, which used to break the package outright. Do not "simplify" it back.
- **Never put a parameter annotation into generated call-site code.**
  `foo(x: int=1)` is a syntax error. `CallParam.name` is the bare name for code,
  `CallParam.display` is the annotated form for labels.
- **Jedi 0.18 removed `Name.params`.** Use `get_signatures()`. A `hasattr` probe
  for `params` silently returns nothing on modern Jedi, which is exactly the bug
  that made 1.17 stop completing arguments.
- **Windows paths in tests.** `interpreters/locators.ts` picks `path.win32` or
  `path.posix` from `host.env.platform` rather than using the process default,
  so Windows layouts can be tested from Linux. Keep using `pathFor(host)`.
- **Bun and `src/provider.ts`.** Importing the provider into a Bun test has
  segfaulted the runner. Test pure modules directly instead; that is what
  `editor/completion-rules.ts` exists for.

## Conventions

- Comments explain *why*, not *what*. Where the code works around a real
  upstream bug, cite the issue number, as the existing comments do.
- Match the surrounding style: named exports, `readonly` where it holds,
  explicit return types on exported functions.
- Settings changes need three edits kept in sync: `configSchema` and
  `PythonSettings` in `src/config.ts`, plus the table in
  `docs/CONFIGURATION.md`. `test/config.test.ts` enforces the first two.
- New user-visible behaviour needs a `CHANGELOG.md` entry.
- Tests are not optional for pure logic. Bug fixes get a regression test naming
  the issue.

## Scope

Upstream has 113 open issues, triaged in
[docs/UPSTREAM-ISSUES.md](docs/UPSTREAM-ISSUES.md). Do not start working through
them unprompted. Fix what the user asks for, and mention related entries rather
than expanding scope on your own.
