# Upstream issue triage

The original repository
([autocomplete-python/autocomplete-python](https://github.com/autocomplete-python/autocomplete-python))
has 113 open issues, none triaged since Atom was discontinued. They are grouped
below by what 2.0 does about them.

This is a triage, not a promise. "Addressed" means the cause named in the issue
no longer exists in this codebase; most were reported against Atom and cannot be
verified against the original reporter's setup.

## Addressed: Kite and Atom infrastructure

Kite shut down in 2022. Everything related to it, including the `mixpanel`
analytics dependency, has been removed.

| Issue | Title | Resolution |
| --- | --- | --- |
| #468 | Error: certificate has expired | Kite installer removed |
| #466 | 500 from atom.io package tarball | Package targets the Pulsar registry |
| #461 | Invalid response status when following redirection | Kite installer removed |
| #380 | Kite hanging at installation | Kite installer removed |
| #363 | Kite keeps saying it could not install | Kite installer removed |
| #412 | "Show all Members" by default (Atom.io + Kite) | Kite removed |
| #285 | Disable cloud autocompletion by default, ask for telemetry consent | No cloud engine and no telemetry at all |
| #395, #403, #378, #427, #353, #343, #306 | Install failures needing a C/C++ toolchain | Native-dependency chain removed; only `atom-select-list` and `fuzzaldrin-plus` remain |
| #388 | Error compiling Less stylesheet | Stylesheet no longer imports the Kite stylesheet |

## Addressed: the Jedi 0.18 API break

Jedi 0.18 removed `Name.params` and renamed `goto_assignments`. 1.17 probed for
`params` with `hasattr`, so parameter lists silently came back empty.

| Issue | Title | Resolution |
| --- | --- | --- |
| #449 | Not working with jedi after v1.17.0 | Backend targets the Jedi 0.19 API; version checked at startup |
| #450 | v1.17.0 not working | As above |
| #463 | Autocomplete no longer working | As above |
| #451 | Shows lots of parameters, but not the actual function parameters | Parameters now read from `get_signatures()` |
| #445 | Autofilling of function parameters not working | As above |
| #460, #458, #453, #367, #347, #389 | Raw tracebacks from `completion.py` | Startup failures are reported as actionable notifications; a failing request no longer kills the daemon |

## Addressed: crashes and corrupted output

| Issue | Title | Resolution |
| --- | --- | --- |
| #432 | `code for hash md5 was not found` | Request ids are SHA-256; MD5 is unavailable under FIPS-mode OpenSSL |
| #354 | `Failed to parse JSON from "us-ascii"` | stdout is buffered and framed on newlines; unparseable lines are skipped, not thrown |
| #366 | `Failed to parse JSON from "Usage: python-config..."` | As above, plus stdout is muted while a request runs |
| #465 | Error thrown every time an opening bracket is written | Argument completion rewritten; `module_path` of `None` no longer raises |
| #413 | `Cannot read property 'setEncoding' of undefined` | Process access is guarded throughout |
| #251 | Editor hangs when a directory named `python` is on PATH | An interpreter must be an executable *regular file* |
| #377 | UnicodeEncodeError with non-ASCII paths | Daemon streams are forced to UTF-8; covered by a test |
| #186 | "Override Method" produces wrong code | Generates `super().method(...)`; covered by tests |
| #439, #434, #409 | Editor deadlock or freeze | Requests time out after 15s; the daemon is never waited on synchronously |

## Addressed: interpreter selection

The largest cluster. Discovery is now ordered, explicit and inspectable.

| Issue | Title | Resolution |
| --- | --- | --- |
| #277 | Plugin picks the wrong python executable | Ordered discovery, plus an explicit picker that overrides it |
| #312 | `$PROJECT` substituted with the wrong project | Each project root expands the original template; regression test included |
| #338 | No way to switch between conda environments | Conda environments are discovered; the picker switches between them |
| #376 | Integrated pyenv support | pyenv versions and pyenv-virtualenv environments discovered, honouring `.python-version` |
| #355 | Go to definition not working in a virtualenv | Project virtual environments are found first |
| #425 | Completions disabled when the interpreter is unavailable | A clear notification with a link to the picker |
| #394 | "command python is either written wrong or could not be found" | `python3` preferred over bare `python`; spawn failure is reported properly |
| #232 | Use an already-installed jedi if possible | Always has: Jedi is never bundled |
| #204 | Support short executable names in PATH | Every `PATH` entry is scanned |
| #143, #352 | virtualenvs stored outside the project | virtualenvwrapper, Poetry and Pipenv locations are searched |

## Addressed: input handling

| Issue | Title | Resolution |
| --- | --- | --- |
| #416 | How to bind `complete-arguments` | It is a normal command, in the menu and the palette |
| #455 | Cannot change the completion key | Argument completion watches the buffer, not a hard-coded keystroke |
| #467 | Cannot work out how to set manual autocomplete | Documented in `docs/CONFIGURATION.md` |
| #328 | `TextEditor.get` is deprecated | No deprecated APIs remain |
| #331 | Should only activate when Python is used | Activation hook is `source.python:root-scope-used` |

## Partly addressed

| Issue | Title | Notes |
| --- | --- | --- |
| #418, #320 | Completions are slow | First request pays for daemon startup; the fuzzy matcher now serves a whole identifier from one lookup. Jedi's own speed is unchanged. |
| #233 | Huge memory usage | The daemon exits after an idle period (configurable, 10 min default) instead of holding Jedi's caches all session. |
| #344 | Docstrings are unscrollable | The tooltip overlay scrolls. The autocomplete-plus description pane belongs to that package. |
| #400 | The function-type UI is too small | Stylesheet cleaned up; layout is mostly autocomplete-plus's. |

## Not addressed

Upstream behaviour kept as-is, or out of scope for a modernization.

| Issue | Title | Why |
| --- | --- | --- |
| #384 | Type hint support | Comes from Jedi; improves by upgrading Jedi |
| #404, #371, #372, #402, #419, #444, #399, #375 | Specific completion results | Jedi behaviour, not ours. Report to Jedi. |
| #230 | Go-to-definition on async methods | Jedi behaviour |
| #340 | Complete Arguments on decorated methods | Jedi cannot always resolve a decorated signature |
| #295 | WSL environments | Needs a path-translation layer; no design yet |
| #226 | Remote servers over SSH | Out of scope; a language-server setup fits better |
| #270 | Use the shebang to pick the interpreter | Reasonable, not implemented. Would slot in as another locator. |
| #406 | Argument completion for class construction from `__init__` | Reasonable, not implemented |
| #430 | Inject custom Python docs | Out of scope |
| #349 | Improve the debugger package's UI | Different package |
| #391, #364 | Fuzzy match does not replace typed text | Marked `invalid`/`wontfix` upstream; autocomplete-plus owns insertion |
| #411, #393, #361, #365, #357, #383, #390, #387, #447, #459, #407, #322, #336, #337, #302, #304, #301, #257, #314, #333, #368, #382, #291, #356, #362, #369, #428, #431, #408, #345, #235, #181 | Unreproducible, incomplete, or Atom-specific | Reported against Atom with no reproduction. Please re-file against 2.0 if still present. |

## Re-reporting

If one of these still affects you on Pulsar with 2.0, please open a fresh issue
at <https://github.com/romulofer/autocomplete-python/issues> with the output of
**Autocomplete Python Pulsar: Show Environment**. Old Atom-era reports cannot be
verified.
