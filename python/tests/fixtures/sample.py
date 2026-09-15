"""Fixture module used by the integration tests."""


class Base:
    def greet(self, name: str, punctuation: str = "!") -> str:
        """Say hello to someone."""
        return f"Hello, {name}{punctuation}"


class Child(Base):
    pass


MAX_RETRIES = 3
total = 41 + 1
