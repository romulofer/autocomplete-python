"""Startup checks: stream encoding, Python version, and importing Jedi.

Kept apart from the rest so the daemon can report an unusable environment as a
notification the user can act on, instead of as a raw traceback on stderr.
"""

from __future__ import annotations

import re
import sys
import traceback
from typing import Any, NoReturn

from . import protocol

MIN_PYTHON_VERSION = (3, 10)
MIN_JEDI_VERSION = (0, 19)


class FatalStartupError(Exception):
    """Raised when the daemon cannot serve requests in this environment."""

    def __init__(self, kind: str, message: str, detail: str) -> None:
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.detail = detail

    def as_payload(self) -> dict[str, Any]:
        return protocol.fatal_error(self.kind, self.message, self.detail)


def version_tuple(text: str) -> tuple[int, ...]:
    """`0.19.2rc1` -> `(0, 19, 2)`. Tolerates suffixes and missing parts."""
    return tuple(int(part) for part in re.findall(r"\d+", text)[:3])


def configure_streams() -> None:
    """Force UTF-8 on the pipes.

    Without this the daemon inherits the locale encoding, and a file whose path
    or contents contain non-ASCII characters raises ``UnicodeEncodeError`` while
    the response is serialized. Upstream issue #377.
    """
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")


def check_python_version(version_info: tuple[int, ...] | None = None) -> None:
    """Raise :class:`FatalStartupError` when the interpreter is too old."""
    current = tuple(version_info or sys.version_info[:3])
    if current >= MIN_PYTHON_VERSION:
        return
    raise FatalStartupError(
        protocol.FATAL_PYTHON_TOO_OLD,
        "autocomplete-python-pulsar needs a newer Python.",
        "Running {}; {}.{} or newer is required.".format(
            ".".join(str(part) for part in current), *MIN_PYTHON_VERSION
        ),
    )


def check_jedi_version(jedi_version: str) -> None:
    """Raise :class:`FatalStartupError` when Jedi predates the API we use."""
    if version_tuple(jedi_version)[:2] >= MIN_JEDI_VERSION:
        return
    raise FatalStartupError(
        protocol.FATAL_JEDI_TOO_OLD,
        "autocomplete-python-pulsar needs a newer Jedi.",
        "Found jedi {}; {}.{} or newer is required.".format(
            jedi_version, *MIN_JEDI_VERSION
        ),
    )


def load_jedi() -> Any:
    """Import Jedi, translating an import failure into a reportable error."""
    try:
        import jedi
    except ImportError:
        raise FatalStartupError(
            protocol.FATAL_JEDI_MISSING,
            "autocomplete-python-pulsar could not import Jedi.",
            traceback.format_exc(),
        ) from None
    check_jedi_version(jedi.__version__)
    return jedi


def bootstrap() -> Any:
    """Run every startup check and return the imported ``jedi`` module."""
    configure_streams()
    check_python_version()
    return load_jedi()


def abort(error: FatalStartupError) -> NoReturn:
    """Report a startup failure to the editor and exit."""
    protocol.write(error.as_payload())
    raise SystemExit(1)
