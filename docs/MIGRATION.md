# Migrating from 1.x

Version 2.0 targets Pulsar and modern Python. If you used the Atom package,
here is what changed for you.

## Nothing to do in the common case

Your existing settings are read as before. Open a Python file and completions
should work. Two things are worth checking:

1. **Jedi must be 0.19 or newer**, installed for the interpreter in use:
   `python3 -m pip install --upgrade "jedi>=0.19"`.
2. **Python must be 3.10 or newer.** Python 2 is no longer supported.

Run **Autocomplete Python: Show Environment** to confirm both at once.

## Kite is gone

Kite shut down in 2022 and its servers no longer exist. Everything related to it
has been removed: the `useKite` setting, the installer flow, the bundled
`kite-installer` dependency, and the `mixpanel` analytics dependency that came
with it.

**The package no longer sends any telemetry.**

If you have `"useKite"` left in your `config.cson`, it is ignored and can be
deleted.

## Settings

| 1.x setting | 2.0 |
| --- | --- |
| `useKite` | Removed: Kite no longer exists |
| `enableTouchBar` | Removed: it relied on Electron's `remote` module, which modern Pulsar does not expose |
| everything else | Unchanged |

New in 2.0:

| Setting | Why |
| --- | --- |
| `selectedInterpreter` | Written by the new interpreter picker; beats every other source |
| `daemonIdleTimeout` | The 10-minute process kill is now configurable, and no longer kills a daemon that is in use |

`Regex To Trigger Autocompletions` no longer requires restarting the editor.

## New commands

| Command | What it does |
| --- | --- |
| `autocomplete-python:select-interpreter` | Pick from every discovered environment |
| `autocomplete-python:show-environment` | Report the interpreter and Jedi version in use |
| `autocomplete-python:restart-daemon` | Restart the Python process |

There is also a status bar entry showing the active environment; click it to
change interpreter.

## Behaviour changes you may notice

- **Interpreter discovery is much broader.** Poetry, Pipenv, pyenv (including
  `.python-version`), Conda and virtualenvwrapper environments are all found
  now. It is also ordered and predictable, so a project with several candidate
  environments no longer picks one at random.
- **Override method generates `super().method(...)`** instead of
  `super(Class, self).method(...)`.
- **Argument snippets use bare parameter names.** Previously an annotated
  parameter with a default produced `foo(x: int=1)`, which is a syntax error at
  a call site.
- **Argument completion watches the buffer, not keystrokes.** It used to listen
  for the `^(` keystroke and silently did nothing on keyboard layouts where `(`
  is not shift-9.
- **Renaming applies edits back-to-front**, which fixes corrupted output when
  two usages shared a line.
- **A missing interpreter or missing Jedi now produces an actionable
  notification** instead of a raw traceback.

## If you package or fork this

The source layout changed completely:

- CoffeeScript in `lib/` → TypeScript in `src/`, compiled to `dist/`
- `lib/completion.py` → `python/completion.py` plus the `python/acp_jedi/`
  package
- `atom-space-pen-views` / `space-pen` → `atom-select-list`
- `atom-slick` / `selector-kit` / `underscore` → removed

`dist/` is committed, because `ppm` installs the git tag as-is and does not run
a build. Run `npm run build` before committing a source change.

See [ARCHITECTURE.md](ARCHITECTURE.md).
