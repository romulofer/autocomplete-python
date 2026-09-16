# Configuration

All settings live under **Settings → Packages → autocomplete-python-pulsar**, or in
`config.cson` under `"autocomplete-python-pulsar"`.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `selectedInterpreter` | `''` | Full path to the interpreter chosen through the picker. Beats every other source. Clear it to go back to automatic discovery. |
| `showDescriptions` | `true` | Show docstrings in the completion list. With this off, a generated signature is shown instead. |
| `useSnippets` | `none` | Fill in function arguments after `(`. `all` includes parameters that have defaults; `required` only those that do not. |
| `pythonPaths` | `''` | Semicolon-separated interpreter paths, highest priority first. |
| `extraPaths` | `''` | Semicolon-separated extra import paths for Jedi. |
| `caseInsensitiveCompletion` | `true` | Match completions regardless of case. |
| `triggerCompletionRegex` | `([. (]\|[a-zA-Z_][a-zA-Z0-9_]*)` | Prefixes that request completions. Applied immediately: no restart. |
| `fuzzyMatcher` | `true` | `stdr` matches `stderr`. Also lets one Jedi lookup serve a whole identifier, so completions are faster. |
| `showTooltips` | `false` | Show the docstring of the symbol under the cursor as an overlay. |
| `suggestionPriority` | `3` | Rank against other autocomplete-plus providers. Snippets use 2. |
| `daemonIdleTimeout` | `10` | Minutes of inactivity before the Python process is shut down. `0` keeps it alive for the session. |
| `outputProviderErrors` | `false` | Surface daemon tracebacks as notifications. Fatal errors are always shown. |
| `outputDebug` | `false` | Verbose logging to the developer console. Slows the editor. |
| `runArguments` | `''` | Arguments passed to the script when you run it. |
| `runWorkingDirectory` | `file` | `file` runs from the file's directory, `project` from the project root. |
| `saveBeforeRun` | `true` | Save the file before running it. |
| `clearOutputOnRun` | `true` | Empty the output pane when a run starts. |
| `showOutputOnRun` | `true` | Reveal the output pane when a run starts. |

## Interpreter discovery

Sources are consulted in this order; the first hit wins, and an interpreter
found twice keeps its highest-priority label.

| # | Source | Where it looks |
| --- | --- | --- |
| 1 | Selected | `selectedInterpreter` |
| 2 | Settings | `pythonPaths` |
| 3 | Shell | `VIRTUAL_ENV`, `CONDA_PREFIX` |
| 4 | Workspace | `.venv`, `venv`, `.env`, `env`, `virtualenv`, or any project directory containing `pyvenv.cfg` |
| 5 | Poetry | `POETRY_VIRTUALENVS_PATH`, else the platform cache directory. Environments whose name starts with an open project's name are promoted. |
| 6 | Pipenv | `WORKON_HOME`, else `~/.local/share/virtualenvs` |
| 7 | pyenv | `$PYENV_ROOT/versions/*` and `*/envs/*`. A version pinned by a project's `.python-version` is promoted. |
| 8 | Conda | `CONDA_ROOT`, `~/anaconda3`, `~/miniconda3`, `~/miniforge3`, `~/mambaforge`, `/opt/conda`, plus each `envs/` and `~/.conda/envs` |
| 9 | virtualenvwrapper | `WORKON_HOME`, else `~/.virtualenvs` |
| 10 | PATH | Every `PATH` entry |
| 11 | System | `/usr/local/bin`, `/usr/bin`, `/bin`, `/opt/homebrew/bin`, `~/.local/bin`; on Windows, `C:\PythonXY` and the per-user `Programs\Python` |

Within one directory, `python3` is preferred over `python3.12`, which is
preferred over bare `python`.

Discovery never walks a project tree recursively. Only the conventional
directory names and directories carrying a `pyvenv.cfg` are probed, so opening a
large project costs nothing.

The result is cached until a relevant setting changes, the project roots change,
or you run **Restart Daemon**.

## Path substitution

`pythonPaths` and `extraPaths` both expand two variables, once per open project
root:

- `$PROJECT`: the absolute path of the project root
- `$PROJECT_NAME`: its directory name

```
$PROJECT/.venv/bin/python;/Users/me/.virtualenvs/$PROJECT_NAME/bin/python;/usr/bin/python3
```

With two project roots open, each root produces its own expansion of the
original template.

## Extra paths

You do not need `extraPaths` for packages installed into the interpreter itself,
because Jedi already sees those. It is for source trees that are importable at runtime
but not installed, for example a generated protobuf directory or a sibling
checkout:

```
$PROJECT/generated;$PROJECT/../shared/src
```

## Argument completion

With `useSnippets` set to `all` or `required`, typing `(` after a callable
inserts a tab-navigable snippet:

```python
greet(name, punctuation="!")   # declaration

greet(|)                       # type the paren
greet(${1:name}, punctuation=${2:"!"})$0   # all
greet(${1:name})$0                         # required
```

Keyword arguments are always emitted with the bare parameter name: an
annotation is valid in a declaration but a syntax error at a call site.

This needs Pulsar's bundled `snippets` package, which is enabled by default.
Trigger it manually at any time with
`autocomplete-python-pulsar:complete-arguments`.

Argument completion watches the buffer rather than raw keystrokes, so it works
on any keyboard layout.

## Running a file

`autocomplete-python-pulsar:run-file` (`F5`, or the button in the status bar)
runs the active file with **the interpreter the package discovered**. That is
the point of running it from here rather than from a generic task runner: the
script runs in the same environment the completions came from, so an import that
resolves in the editor also resolves at runtime.

Output goes to a **Python Output** pane in the bottom dock: stdout in the normal
colour, stderr in red, and a header with the command, the working directory and
the exit code. The pane keeps the last 5000 lines.

The status bar button doubles as the run indicator. While a script is going it
turns into a stop button; `Shift+F5` and the Stop button in the pane do the same
thing. Starting a run while one is already going stops the old one first.

While a script is running the pane shows an input field. Type a line and press
Enter to send it to the script's stdin; it is echoed into the transcript. The
**EOF** button closes stdin, which is what a script doing `sys.stdin.read()`
waits for. This is what makes a script that calls `input()` usable from the pane
rather than sitting there apparently hung.

Scripts are spawned directly, with no shell involved, so nothing in
`Run: Script Arguments` is interpreted as a shell operator. Quoting works the way
it does in a shell: a quote may open partway through a word, and both halves stay
one argument. A backslash is a literal character, not an escape.

```
--input "/tmp/my data.csv" --name="value with spaces" --json='{"limit": 10}'
```

Output is unbuffered, so it appears as the script produces it rather than all at
once when it exits.
