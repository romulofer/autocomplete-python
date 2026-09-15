"""The wire format shared with the editor.

Requests and responses are newline-delimited JSON on the daemon's stdin and
stdout. Every request carries an ``id`` that is echoed back on its response,
which is how the editor matches answers to callers.

Two response ids are reserved for the daemon's own state:

``__ready__``
    Written once at startup with the Python and Jedi versions in use.
``__error__``
    Written when the daemon cannot start; the process exits right afterwards.

Nothing here imports Jedi, so the protocol can be exercised on its own.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Iterator, TextIO

HANDSHAKE_ID = "__ready__"
FATAL_ERROR_ID = "__error__"

#: Values the editor knows how to explain to the user.
FatalErrorKind = str  # one of the FATAL_* constants below

FATAL_JEDI_MISSING = "jedi-missing"
FATAL_JEDI_TOO_OLD = "jedi-too-old"
FATAL_PYTHON_TOO_OLD = "python-too-old"
FATAL_UNKNOWN = "unknown"


def response(identifier: str | None, results: list[Any], **extra: Any) -> dict[str, Any]:
    """Build a normal response payload."""
    return {"id": identifier, "results": results, **extra}


def handshake(python_version: str, jedi_version: str) -> dict[str, Any]:
    """Build the startup payload that tells the editor what is running."""
    return response(HANDSHAKE_ID, [], python=python_version, jedi=jedi_version)


def fatal_error(kind: FatalErrorKind, message: str, detail: str) -> dict[str, Any]:
    """Build the payload for a failure that stops the daemon from starting."""
    return response(FATAL_ERROR_ID, [], error=kind, message=message, detail=detail)


def write(payload: dict[str, Any], stream: TextIO | None = None) -> None:
    """Write one response line and flush it.

    Defaults to the *original* stdout rather than ``sys.stdout``: while a
    request is being handled, ``sys.stdout`` is redirected to ``os.devnull`` so
    that anything a project module prints on import cannot land in the middle of
    the response stream.
    """
    target = stream if stream is not None else sys.__stdout__
    assert target is not None  # stdout is always present for a spawned daemon
    target.write(json.dumps(payload) + "\n")
    target.flush()


def read_requests(stream: TextIO | None = None) -> Iterator[dict[str, Any]]:
    """Yield one decoded request per non-empty input line."""
    source = stream if stream is not None else sys.stdin
    for line in source:
        line = line.strip()
        if line:
            yield json.loads(line)
