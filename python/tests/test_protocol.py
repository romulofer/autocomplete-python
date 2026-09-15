"""The JSON wire format."""

from __future__ import annotations

import io
import json

import pytest

from acp_jedi import protocol


def test_response_carries_the_identifier_back():
    assert protocol.response("abc", [1, 2]) == {"id": "abc", "results": [1, 2]}


def test_response_accepts_extra_fields():
    payload = protocol.response("abc", [], arguments="${1:x}$0")
    assert payload["arguments"] == "${1:x}$0"


def test_handshake_reports_both_versions():
    payload = protocol.handshake("3.12.4", "0.19.2")
    assert payload["id"] == protocol.HANDSHAKE_ID
    assert payload["python"] == "3.12.4"
    assert payload["jedi"] == "0.19.2"
    assert payload["results"] == []


def test_fatal_error_names_the_kind_and_keeps_the_detail():
    payload = protocol.fatal_error(
        protocol.FATAL_JEDI_MISSING, "no jedi", "Traceback..."
    )
    assert payload["id"] == protocol.FATAL_ERROR_ID
    assert payload["error"] == "jedi-missing"
    assert payload["message"] == "no jedi"
    assert payload["detail"] == "Traceback..."


def test_reserved_ids_cannot_collide_with_a_request_id():
    # Request ids are hex sha256 digests, so a leading underscore is safe.
    assert protocol.HANDSHAKE_ID.startswith("__")
    assert protocol.FATAL_ERROR_ID.startswith("__")
    assert protocol.HANDSHAKE_ID != protocol.FATAL_ERROR_ID


def test_write_emits_exactly_one_line():
    stream = io.StringIO()
    protocol.write({"id": "a", "results": []}, stream)
    protocol.write({"id": "b", "results": []}, stream)

    lines = stream.getvalue().splitlines()
    assert [json.loads(line)["id"] for line in lines] == ["a", "b"]


def test_write_emits_valid_json_for_non_ascii_content():
    stream = io.StringIO()
    protocol.write({"id": "a", "results": ["café", "日本語"]}, stream)
    assert json.loads(stream.getvalue())["results"] == ["café", "日本語"]


def test_read_requests_skips_blank_lines():
    stream = io.StringIO('{"id":"a"}\n\n   \n{"id":"b"}\n')
    assert [request["id"] for request in protocol.read_requests(stream)] == [
        "a",
        "b",
    ]


def test_read_requests_raises_on_malformed_json():
    stream = io.StringIO("not json\n")
    with pytest.raises(ValueError):
        list(protocol.read_requests(stream))
