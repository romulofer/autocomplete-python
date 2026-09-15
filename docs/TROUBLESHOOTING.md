# Troubleshooting

## Start here

Run **Autocomplete Python: Show Environment** from the command palette. It
reports the interpreter in use, how it was found, the Jedi version, and every
other candidate in priority order. Most reports are answered by that one
notification.

If nothing at all happens, check that the status bar shows a 🐍 entry. If it
does not, the package has not activated: it only activates once a file with the
`source.python` grammar is open.

## "could not find a Python interpreter"

Nothing matching `python`, `python3` or `python3.x` was found anywhere the
package looks.

1. Run **Autocomplete Python: Select Interpreter** and pick one from the list.
2. If the list is empty, set `Python Executable Paths` to the full path of your
   interpreter, including the executable name.
3. Run **Autocomplete Python: Restart Daemon**.

Note that the package needs an executable *file*. A directory named `python` on
your `PATH` is ignored.

## "could not import Jedi"

Jedi is not installed for the interpreter the package chose: which is often not
the interpreter you had in mind. Check which one it is with **Show
Environment**, then:

```sh
/path/to/that/python -m pip install --upgrade "jedi>=0.19"
```

Then **Restart Daemon**.

## "needs a newer Jedi" / "needs a newer Python"

The package requires Python 3.10+ and Jedi 0.19+. Jedi 0.18 removed
`Name.params` and renamed `goto_assignments`, so older versions cannot work.
Upgrade Jedi, or pick a newer interpreter with **Select Interpreter**.

## The wrong interpreter is being used

Discovery is ordered, and an explicit choice beats everything. Use **Select
Interpreter**; it writes `selectedInterpreter`, which sits above every other
source. Clear that setting to return to automatic discovery.

If you want a per-project rule instead, use `$PROJECT` in `Python Executable
Paths`: see [CONFIGURATION.md](CONFIGURATION.md).

## No completions for my third-party packages

Jedi sees whatever the chosen interpreter can import. Either:

- point the package at the interpreter inside the environment where those
  packages are installed (**Select Interpreter**), or
- add the source tree to `Extra Paths For Packages` if it is importable at
  runtime but not installed.

## No completions at all in a file

- Confirm the grammar is Python: the package binds to `source.python`.
- Completions are suppressed inside comments and strings by design.
- `Regex To Trigger Autocompletions` may be too narrow. Reset it to the default
  and try again.

## Argument completion does nothing after `(`

- `Autocomplete Function Parameters` defaults to `none`. Set it to `all` or
  `required`.
- It needs Pulsar's bundled `snippets` package enabled.
- Arguments are only completed when nothing but whitespace or the closing paren
  follows the cursor: existing arguments are never rewritten.
- Try `autocomplete-python:complete-arguments` directly. If that works but
  typing `(` does not, file an issue with your keyboard layout.

## Completions are slow

- The first request of a session pays for spawning Python and warming Jedi's
  cache. Later ones are much faster.
- Keep `Use Fuzzy Matcher` on: it lets one lookup serve every keystroke of an
  identifier instead of one round trip per character.
- Turn `Output Debug Logs` off.
- Very large `Extra Paths` make Jedi do more work on every request.
- A request that takes longer than 15 seconds is abandoned and returns nothing
  rather than hanging the editor.

## Python keeps running after I stop typing

By design, briefly: the daemon stays alive for `Daemon Idle Timeout` minutes
(default 10) so the next completion is instant, then exits. Set it to `0` to
keep it for the whole session, or to `1` to reclaim memory sooner.

## Something threw a traceback

Turn on `Output Provider Errors` to see tracebacks from the daemon as
notifications. Tracebacks that come from inside Jedi belong on
[Jedi's issue tracker](https://github.com/davidhalter/jedi/issues), not this
one: the notification says which is which.

For a full log, turn on `Output Debug Logs` and open the developer console
(**View → Developer → Toggle Developer Tools**).

## Reporting a bug

Please include:

- the output of **Show Environment**
- your Pulsar version (`pulsar --version`)
- the relevant part of the developer console with `Output Debug Logs` on
- a small Python snippet that reproduces it

<https://github.com/romulofer/autocomplete-python/issues>
