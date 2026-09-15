"""The request loop.

Reads requests until stdin closes, answering each one. A failure while handling
a request is reported on stderr and the loop continues: one bad request must not
take the daemon down.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from contextlib import redirect_stdout
from typing import Any, Sequence, TextIO

from . import protocol, runtime
from .session import JediSession


class Daemon:
    def __init__(self, session: JediSession) -> None:
        self.session = session

    def handshake_payload(self) -> dict[str, Any]:
        return protocol.handshake(
            "{}.{}.{}".format(*sys.version_info[:3]),
            self.session.jedi.__version__,
        )

    def handle(self, request: dict[str, Any], devnull: TextIO) -> dict[str, Any]:
        """Answer one request with stdout muted.

        Anything a project module prints while Jedi imports it would otherwise
        land in the middle of the response stream and break the editor's parse.
        """
        with redirect_stdout(devnull):
            return self.session.handle(request)

    def run(self, stdin: TextIO | None = None) -> int:
        protocol.write(self.handshake_payload())

        with open(os.devnull, "w", encoding="utf-8") as devnull:
            for request in self._iter_requests(stdin):
                if request is None:
                    continue
                try:
                    protocol.write(self.handle(request, devnull))
                except Exception:
                    self._report_exception()
        return 0

    def _iter_requests(self, stdin: TextIO | None):
        source = stdin if stdin is not None else sys.stdin
        for line in source:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except ValueError:
                self._report_exception()
                yield None

    @staticmethod
    def _report_exception() -> None:
        sys.stderr.write(traceback.format_exc() + "\n")
        sys.stderr.flush()


def main(argv: Sequence[str]) -> int:
    """Entry point. With arguments, answer them and exit; otherwise serve."""
    try:
        jedi = runtime.bootstrap()
    except runtime.FatalStartupError as error:
        runtime.abort(error)

    daemon = Daemon(JediSession(jedi))

    if argv:
        # One-shot mode: each argument is a JSON request. Useful for debugging
        # and for the test suite.
        with open(os.devnull, "w", encoding="utf-8") as devnull:
            for raw_request in argv:
                protocol.write(
                    daemon.handle(json.loads(raw_request), devnull)
                )
        return 0

    return daemon.run()
