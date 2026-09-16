"""The request loop: framing, error isolation, and the handshake."""

from __future__ import annotations

import io
import json

import pytest

from acp_jedi import protocol, runtime
from acp_jedi.daemon import Daemon, main
from acp_jedi.session import JediSession

from conftest import FakeScript
from test_session import FakeJedi


def make_daemon(script: FakeScript | None = None) -> Daemon:
    return Daemon(JediSession(FakeJedi(script), default_sys_path=[]))


def run(daemon: Daemon, lines: str, capfd) -> list[dict]:
    """Drive the loop over `lines` and return every response it wrote.

    Capture happens at the file-descriptor level: responses deliberately go to
    `sys.__stdout__` so that redirecting `sys.stdout` during a request cannot
    swallow them.
    """
    daemon.run(io.StringIO(lines))
    out = capfd.readouterr().out
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def request(**overrides) -> str:
    payload = {
        "id": "req-1",
        "lookup": "completions",
        "path": None,
        "source": "x",
        "line": 0,
        "column": 0,
        "config": {},
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_handshake_is_written_before_any_response(capfd):
    payloads = run(make_daemon(), request(), capfd)
    assert payloads[0]["id"] == protocol.HANDSHAKE_ID
    assert payloads[0]["jedi"] == "0.19.2"
    assert payloads[1]["id"] == "req-1"


def test_handshake_reports_the_running_python(capfd):
    payloads = run(make_daemon(), "", capfd)
    assert payloads[0]["python"].count(".") == 2


def test_one_response_per_request(capfd):
    payloads = run(
        make_daemon(),
        request(id="a") + "\n" + request(id="b") + "\n",
        capfd,
    )
    assert [payload["id"] for payload in payloads[1:]] == ["a", "b"]


def test_blank_lines_are_ignored(capfd):
    payloads = run(make_daemon(), "\n\n   \n" + request() + "\n", capfd)
    assert len(payloads) == 2


def test_malformed_json_does_not_stop_the_loop(capfd):
    payloads = run(
        make_daemon(),
        "this is not json\n" + request(id="after") + "\n",
        capfd,
    )
    assert [payload["id"] for payload in payloads[1:]] == ["after"]


def test_a_failing_request_does_not_stop_the_loop(capfd):
    # A request without `source` raises a KeyError inside the session.
    broken = json.dumps({"id": "broken", "lookup": "completions", "line": 0, "column": 0})
    payloads = run(
        make_daemon(),
        broken + "\n" + request(id="after") + "\n",
        capfd,
    )
    assert [payload["id"] for payload in payloads[1:]] == ["after"]


def test_stray_prints_never_reach_the_response_stream(capfd):
    class NoisyScript(FakeScript):
        def complete(self, line, column):
            print("a project module said hello")
            return []

    payloads = run(make_daemon(NoisyScript()), request() + "\n", capfd)
    # Every line on stdout parsed as JSON, so the print was swallowed.
    assert [payload["id"] for payload in payloads] == [
        protocol.HANDSHAKE_ID,
        "req-1",
    ]


def test_run_returns_zero_when_stdin_closes(capfd):
    assert make_daemon().run(io.StringIO("")) == 0
    capfd.readouterr()


# --- main() ---------------------------------------------------------------


def test_main_answers_one_shot_requests_and_exits(capfd, monkeypatch):
    # With arguments, the entry point answers each JSON request and returns,
    # rather than serving stdin; the handshake belongs to the serving loop only.
    monkeypatch.setattr(runtime, "bootstrap", lambda: FakeJedi())

    exit_code = main([request(id="one"), request(id="two")])

    out = capfd.readouterr().out
    payloads = [json.loads(line) for line in out.splitlines() if line.strip()]
    assert exit_code == 0
    assert [payload["id"] for payload in payloads] == ["one", "two"]


def test_main_serves_stdin_when_given_no_arguments(capfd, monkeypatch):
    monkeypatch.setattr(runtime, "bootstrap", lambda: FakeJedi())
    monkeypatch.setattr("sys.stdin", io.StringIO(request(id="served") + "\n"))

    exit_code = main([])

    out = capfd.readouterr().out
    payloads = [json.loads(line) for line in out.splitlines() if line.strip()]
    assert exit_code == 0
    assert payloads[0]["id"] == protocol.HANDSHAKE_ID
    assert payloads[1]["id"] == "served"


def test_main_aborts_when_bootstrap_fails(capfd, monkeypatch):
    def explode():
        raise runtime.FatalStartupError("jedi-missing", "no jedi here", "install it")

    monkeypatch.setattr(runtime, "bootstrap", explode)

    with pytest.raises(SystemExit) as caught:
        main([])
    assert caught.value.code == 1
    capfd.readouterr()
