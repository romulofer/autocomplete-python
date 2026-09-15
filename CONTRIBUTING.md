# Contributing

## Setup

```sh
git clone https://github.com/romulofer/autocomplete-python.git
cd autocomplete-python
npm install
python3 -m pip install -r python/requirements-dev.txt
npm run build
ppm link .
```

Restart Pulsar, open a Python file, and the linked package takes over.

## Working on it

```sh
npm run watch        # rebuild src/ on change
npm run typecheck    # tsc --noEmit
npm run test:ts      # bun test
npm run test:py      # python3 -m pytest
npm test             # all of the above
```

Reload Pulsar (`Ctrl+Shift+F5`) to pick up a rebuild.

You can drive the Python backend without the editor:

```sh
python3 python/completion.py '{"id":"1","lookup":"completions","path":null,"source":"import os\nos.","line":1,"column":3,"config":{}}'
```

## Before opening a pull request

- `npm run build`, and commit `dist/`. It is checked in because `ppm` installs
  the git tag as-is and does not run a build.
- `npm test` passes.
- New pure logic has tests. Bug fixes have a regression test naming the issue.
- User-visible changes have a `CHANGELOG.md` entry.
- New settings are added in all three places: `configSchema` and
  `PythonSettings` in `src/config.ts`, and the table in `docs/CONFIGURATION.md`.

## Where things go

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the layout. The rule that
matters: modules that touch `atom`, `fs` or `process.env` live in `src/host/` or
`src/views/`; everything else takes what it needs as a parameter and gets a
test.

## Style

- Comments say why, not what. Cite an upstream issue number when the code works
  around a real bug.
- No em dashes in prose.
- Match the surrounding code.

## Reporting bugs

Include the output of **Autocomplete Python: Show Environment**, your Pulsar
version, and a snippet that reproduces the problem. Tracebacks raised inside
Jedi belong on [Jedi's tracker](https://github.com/davidhalter/jedi/issues); the
notification tells you which is which.
