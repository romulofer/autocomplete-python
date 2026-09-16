"""End-to-end coverage against a real Jedi installation.

These tests spawn `python/completion.py` exactly as the editor does and speak
the real protocol to it, so they cover the pieces the unit tests stub out: the
Jedi API itself, the startup handshake, and the stdin/stdout framing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

import pytest

pytestmark = pytest.mark.requires_jedi

DAEMON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "completion.py"
)

DEFAULT_CONFIG = {
    "extraPaths": [],
    "useSnippets": "all",
    "caseInsensitiveCompletion": True,
    "showDescriptions": False,
    "fuzzyMatcher": True,
}


@pytest.fixture(scope="module")
def fixtures() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def ask(requests: list[dict], timeout: int = 60) -> dict[str, dict]:
    """Run the daemon over `requests` and return the responses keyed by id."""
    payload = "\n".join(json.dumps(request) for request in requests) + "\n"
    completed = subprocess.run(
        [sys.executable, "-u", DAEMON],
        input=payload,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    responses = {}
    for line in completed.stdout.splitlines():
        if not line.strip():
            continue
        decoded = json.loads(line)
        responses[decoded["id"]] = decoded
    responses["__stderr__"] = {"text": completed.stderr}
    return responses


def build(identifier: str, source: str, line: int, column: int, **overrides) -> dict:
    request = {
        "id": identifier,
        "lookup": "completions",
        "path": None,
        "source": source,
        "line": line,
        "column": column,
        "config": dict(DEFAULT_CONFIG),
    }
    request.update(overrides)
    return request


def test_daemon_announces_itself(jedi):
    responses = ask([])
    handshake = responses["__ready__"]
    assert handshake["jedi"] == jedi.__version__
    assert handshake["python"].startswith(
        "{}.{}".format(*sys.version_info[:2])
    )


def test_completes_a_builtin(jedi):
    responses = ask([build("c", "isinstanc", 0, 9, prefix="isinstanc")])
    names = [entry["text"] for entry in responses["c"]["results"]]
    assert "isinstance" in names


def test_completes_a_locally_defined_function(jedi):
    source = "def hello_world():\n    return True\nhello_"
    responses = ask([build("c", source, 2, 6, prefix="hello_")])
    assert [entry["text"] for entry in responses["c"]["results"]] == ["hello_world"]


def test_completion_carries_a_generated_signature(jedi, fixtures):
    source = "from sample import Base\nBase().gree"
    responses = ask(
        [
            build(
                "c",
                source,
                1,
                11,
                prefix="gree",
                path=os.path.join(fixtures, "consumer.py"),
            )
        ]
    )
    greet = next(
        entry for entry in responses["c"]["results"] if entry["text"] == "greet"
    )
    # Jedi 0.18 removed `Name.params`; parameters must come from get_signatures().
    assert "name" in greet["description"]
    assert "punctuation" in greet["description"]


def test_goes_to_a_definition(jedi, fixtures):
    # A definition needs a backing file: an unsaved buffer has nothing the
    # editor could open, so those results are filtered out.
    source = "def abc():\n    return True\nx = abc()"
    responses = ask(
        [
            build(
                "d",
                source,
                2,
                4,
                lookup="definitions",
                path=os.path.join(fixtures, "consumer.py"),
            )
        ]
    )
    results = responses["d"]["results"]
    assert len(results) == 1
    assert results[0]["text"] == "abc"
    # Rows come back zero-based, ready for setCursorBufferPosition.
    assert results[0]["line"] == 0


def test_finds_usages(jedi, fixtures):
    path = os.path.join(fixtures, "sample.py")
    responses = ask(
        [
            build(
                "u",
                open(path, encoding="utf-8").read(),
                3,
                6,
                lookup="usages",
                path=path,
            )
        ]
    )
    names = {entry["name"] for entry in responses["u"]["results"]}
    assert names == {"Base"}
    assert all(entry["fileName"] for entry in responses["u"]["results"])


def test_completes_required_arguments_only(jedi, fixtures):
    source = "from sample import Base\nBase().greet("
    request = build(
        "a",
        source,
        1,
        13,
        lookup="arguments",
        path=os.path.join(fixtures, "consumer.py"),
    )
    request["config"]["useSnippets"] = "required"
    snippet = ask([request])["a"]["arguments"]

    assert snippet == "${1:name}$0"


def test_completes_all_arguments_including_defaults(jedi, fixtures):
    source = "from sample import Base\nBase().greet("
    request = build(
        "a",
        source,
        1,
        13,
        lookup="arguments",
        path=os.path.join(fixtures, "consumer.py"),
    )
    request["config"]["useSnippets"] = "all"
    snippet = ask([request])["a"]["arguments"]

    assert "${1:name}" in snippet
    # The keyword must be the bare parameter name: `punctuation: str="!"` is a
    # syntax error at a call site.
    assert 'punctuation=${2:"!"}' in snippet


# Upstream issue #406: completing the arguments of a class construction should
# fill the parameters of `__init__`, with `self` dropped, the same as a plain
# function call.
def test_completes_class_constructor_arguments_from_init(jedi):
    source = (
        "class Greeter:\n"
        "    def __init__(self, name, punctuation='!'):\n"
        "        pass\n"
        "Greeter("
    )
    request = build("a", source, 3, 8, lookup="arguments")
    request["config"]["useSnippets"] = "all"
    snippet = ask([request])["a"]["arguments"]

    assert "self" not in snippet
    assert "${1:name}" in snippet
    assert "punctuation=${2:'!'}" in snippet


def test_completes_constructor_arguments_from_an_inherited_init(jedi):
    source = (
        "class Base2:\n"
        "    def __init__(self, name, punctuation='!'):\n"
        "        pass\n"
        "class Child2(Base2):\n"
        "    pass\n"
        "Child2("
    )
    request = build("a", source, 5, 7, lookup="arguments")
    request["config"]["useSnippets"] = "required"
    snippet = ask([request])["a"]["arguments"]

    assert snippet == "${1:name}$0"


def test_offers_constructor_parameters_as_keyword_completions(jedi):
    source = (
        "class Greeter:\n"
        "    def __init__(self, name, punctuation='!'):\n"
        "        pass\n"
        "Greeter("
    )
    results = ask([build("c", source, 3, 8, prefix="")])["c"]["results"]
    keywords = {
        entry["text"].split("=")[0]
        for entry in results
        if entry.get("type") == "property"
    }
    assert {"name", "punctuation"} <= keywords


# Upstream issue #230: go-to-definition on an async method used to come back
# empty. Jedi resolves the coroutine like any other method.
def test_goes_to_the_definition_of_an_async_method(jedi, fixtures):
    source = (
        "class Fetcher:\n"
        "    async def fetch(self, url):\n"
        "        return url\n"
        "Fetcher().fetch"
    )
    responses = ask(
        [
            build(
                "d",
                source,
                3,
                12,
                lookup="definitions",
                path=os.path.join(fixtures, "consumer.py"),
            )
        ]
    )
    results = responses["d"]["results"]
    assert len(results) == 1
    assert results[0]["text"] == "fetch"
    # The `async def` is the second line, zero-based row 1.
    assert results[0]["line"] == 1


# Upstream issue #340: completing the arguments of a decorated method. Jedi
# resolves the common decorators, so `self`/`cls` drop out as they would for a
# plain method. A hand-rolled decorator that does not use functools.wraps still
# hides the signature, which is a limitation of Python's decoration, not ours.
def test_completes_arguments_of_a_staticmethod(jedi):
    source = (
        "class A:\n"
        "    @staticmethod\n"
        "    def make(alpha, beta=2):\n"
        "        pass\n"
        "A.make("
    )
    request = build("a", source, 4, 7, lookup="arguments")
    request["config"]["useSnippets"] = "required"
    assert ask([request])["a"]["arguments"] == "${1:alpha}$0"


def test_completes_arguments_of_a_classmethod_without_cls(jedi):
    source = (
        "class A:\n"
        "    @classmethod\n"
        "    def make(cls, alpha, beta=2):\n"
        "        pass\n"
        "A.make("
    )
    request = build("a", source, 4, 7, lookup="arguments")
    request["config"]["useSnippets"] = "required"
    snippet = ask([request])["a"]["arguments"]
    assert snippet == "${1:alpha}$0"
    assert "cls" not in snippet


def test_lists_overridable_methods(jedi, fixtures):
    path = os.path.join(fixtures, "sample.py")
    lines = open(path, encoding="utf-8").read().split("\n")
    # Mirror what the provider injects below the cursor inside `Child`.
    insert_at = lines.index("class Child(Base):")
    lines.insert(insert_at + 1, "  def __autocomplete_python(s):")
    lines.insert(insert_at + 2, "    s.")

    responses = ask(
        [
            build(
                "m",
                "\n".join(lines),
                insert_at + 2,
                6,
                lookup="methods",
                path=path,
            )
        ]
    )
    greet = next(
        entry for entry in responses["m"]["results"] if entry["name"] == "greet"
    )
    assert greet["parent"] == "Base"
    assert greet["instance"] == "Child"
    # `self` is stripped: the override template writes its own.
    assert not any(param.startswith("self") for param in greet["params"])
    assert "__autocomplete_python" not in {
        entry["name"] for entry in responses["m"]["results"]
    }


def test_extra_paths_make_a_package_importable(jedi, fixtures):
    request = build("e", "import pkg\npkg.", 1, 4, prefix=".")
    request["config"]["extraPaths"] = [fixtures]
    names = [entry["text"] for entry in ask([request])["e"]["results"]]
    assert "package_helper" in names


def test_tooltip_returns_the_docstring(jedi, fixtures):
    path = os.path.join(fixtures, "consumer.py")
    source = open(path, encoding="utf-8").read()
    responses = ask([build("t", source, 3, 15, lookup="tooltip", path=path)])
    results = responses["t"]["results"]
    assert len(results) <= 1
    if results:
        assert "hello" in results[0]["description"].lower()


def test_survives_a_non_ascii_path_and_source(jedi, tmp_path):
    # Upstream issue #377: the daemon used to die on UnicodeEncodeError.
    directory = tmp_path / "proj-café"
    directory.mkdir()
    module = directory / "módulo.py"
    module.write_text('variável = "ação"\nvariá', encoding="utf-8")

    responses = ask(
        [
            build(
                "u8",
                module.read_text(encoding="utf-8"),
                1,
                5,
                prefix="variá",
                path=str(module),
            )
        ]
    )
    assert "variável" in [entry["text"] for entry in responses["u8"]["results"]]


def test_a_bad_request_does_not_take_the_daemon_down(jedi):
    responses = ask(
        [
            {"id": "broken", "lookup": "completions"},
            build("after", "isinstanc", 0, 9, prefix="isinstanc"),
        ]
    )
    assert "broken" not in responses
    assert responses["after"]["results"]


def test_malformed_input_does_not_take_the_daemon_down(jedi):
    payload = "not json\n" + json.dumps(
        build("after", "isinstanc", 0, 9, prefix="isinstanc")
    ) + "\n"
    completed = subprocess.run(
        [sys.executable, "-u", DAEMON],
        input=payload,
        capture_output=True,
        text=True,
        timeout=60,
    )
    ids = [
        json.loads(line)["id"]
        for line in completed.stdout.splitlines()
        if line.strip()
    ]
    assert "after" in ids


def test_requests_are_isolated_from_each_other(jedi, fixtures):
    """Extra paths from one request must not leak into the next."""
    with_pkg = build("with", "import pkg\npkg.", 1, 4, prefix=".")
    with_pkg["config"]["extraPaths"] = [fixtures]
    without_pkg = build("without", "import pkg\npkg.", 1, 4, prefix=".")

    responses = ask([with_pkg, without_pkg])
    assert "package_helper" in [
        entry["text"] for entry in responses["with"]["results"]
    ]
    assert "package_helper" not in [
        entry["text"] for entry in responses["without"]["results"]
    ]
