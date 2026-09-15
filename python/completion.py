#!/usr/bin/env python3
"""Entry point for the Jedi completion daemon.

The editor spawns this file with the interpreter it discovered. Everything of
substance lives in the :mod:`acp_jedi` package next to it; this script only
makes that package importable and hands over.
"""

from __future__ import annotations

import os
import sys

# The daemon runs under an arbitrary interpreter that knows nothing about this
# package, so its own directory has to go on the path before the import. It is
# prepended rather than appended so a same-named module in the user's project
# cannot shadow it.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from acp_jedi.daemon import main  # noqa: E402  (import follows the path setup)

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
