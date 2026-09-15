"""Jedi backend for the autocomplete-python-pulsar Pulsar package.

The package is deliberately split so each piece can be used and tested on its
own:

:mod:`acp_jedi.protocol`
    The JSON wire format. No Jedi import.
:mod:`acp_jedi.runtime`
    Startup checks and the Jedi import, with failures reportable to the editor.
:mod:`acp_jedi.names`
    Duck-typed readers for Jedi ``Name``/``Signature`` objects.
:mod:`acp_jedi.serializers`
    Jedi results in, JSON-ready data out.
:mod:`acp_jedi.session`
    One request in, one response payload out.
:mod:`acp_jedi.daemon`
    The stdin/stdout loop and the command-line entry point.
"""

__all__ = [
    "daemon",
    "names",
    "protocol",
    "runtime",
    "serializers",
    "session",
]
