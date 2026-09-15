"""Startup checks: version gates and the Jedi import."""

from __future__ import annotations

import pytest

from acp_jedi import protocol, runtime


@pytest.mark.parametrize(
    "text,expected",
    [
        ("0.19.2", (0, 19, 2)),
        ("0.19", (0, 19)),
        ("1.0.0rc1", (1, 0, 0)),
        ("0.19.2.post1", (0, 19, 2)),
    ],
)
def test_version_tuple_parses_release_strings(text, expected):
    assert runtime.version_tuple(text) == expected


def test_check_python_version_accepts_a_supported_interpreter():
    runtime.check_python_version((3, 10, 0))
    runtime.check_python_version((3, 14, 1))


def test_check_python_version_rejects_an_old_interpreter():
    with pytest.raises(runtime.FatalStartupError) as excinfo:
        runtime.check_python_version((3, 8, 10))
    assert excinfo.value.kind == protocol.FATAL_PYTHON_TOO_OLD
    assert "3.8.10" in excinfo.value.detail


def test_check_jedi_version_accepts_the_supported_range():
    runtime.check_jedi_version("0.19.0")
    runtime.check_jedi_version("0.19.2")
    runtime.check_jedi_version("1.0.0")


def test_check_jedi_version_rejects_the_api_we_no_longer_support():
    # Jedi 0.18 removed `Name.params` and renamed `goto_assignments`, so the
    # daemon cannot work against anything older than the version it targets.
    with pytest.raises(runtime.FatalStartupError) as excinfo:
        runtime.check_jedi_version("0.17.2")
    assert excinfo.value.kind == protocol.FATAL_JEDI_TOO_OLD


def test_fatal_startup_error_serializes_to_the_wire_format():
    error = runtime.FatalStartupError(
        protocol.FATAL_JEDI_MISSING, "no jedi", "Traceback..."
    )
    payload = error.as_payload()

    assert payload["id"] == protocol.FATAL_ERROR_ID
    assert payload["error"] == "jedi-missing"
    assert payload["message"] == "no jedi"


def test_load_jedi_reports_a_missing_module(monkeypatch):
    import builtins

    real_import = builtins.__import__

    def fail_on_jedi(name, *args, **kwargs):
        if name == "jedi":
            raise ImportError("No module named 'jedi'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fail_on_jedi)

    with pytest.raises(runtime.FatalStartupError) as excinfo:
        runtime.load_jedi()
    assert excinfo.value.kind == protocol.FATAL_JEDI_MISSING
    assert "No module named" in excinfo.value.detail


def test_abort_writes_the_payload_and_exits(capsys):
    error = runtime.FatalStartupError(
        protocol.FATAL_JEDI_MISSING, "no jedi", "detail"
    )
    with pytest.raises(SystemExit) as excinfo:
        runtime.abort(error)
    assert excinfo.value.code == 1


@pytest.mark.requires_jedi
def test_bootstrap_returns_the_jedi_module(jedi):
    assert runtime.bootstrap() is jedi
