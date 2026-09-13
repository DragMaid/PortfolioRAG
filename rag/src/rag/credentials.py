"""Reading an author's provider credential off the row the API wrote."""

from __future__ import annotations

from dataclasses import dataclass

from psycopg import Connection

from .crypto import SecretUnsealError, unseal
from .db import fetch_one

# Mirrors Backend.Models.Entities.LlmProvider, which is stored as an int.
_PROVIDER_NAMES = {0: "anthropic"}


class MissingCredentialError(RuntimeError):
    """The author has no usable provider key. Not retryable, so the job fails immediately."""


@dataclass(frozen=True, slots=True)
class Credential:
    provider: str
    model: str
    api_key: str


def load(conn: Connection, author_id: int, encryption_key: bytes) -> Credential:
    """The author's key, unsealed, or an error describing which part is missing."""
    row = fetch_one(
        conn,
        """
        SELECT "Provider", "Model", "KeyCiphertext", "ValidatedAt"
        FROM "LlmCredentials"
        WHERE "AuthorId" = %s
        """,
        (author_id,),
    )

    if row is None:
        raise MissingCredentialError("This account has no provider key.")

    # The API refuses to enable anything public on an unvalidated key, so reaching here with
    # one means the key was invalidated between the request being queued and being run —
    # which is exactly when it should not be used.
    if row["ValidatedAt"] is None:
        raise MissingCredentialError(
            "The account's provider key has not been confirmed with the provider."
        )

    provider = _PROVIDER_NAMES.get(row["Provider"])

    if provider is None:
        raise MissingCredentialError(
            f"The stored credential names provider {row['Provider']}, which this worker "
            "does not know. It is probably newer than this build."
        )

    try:
        api_key = unseal(row["KeyCiphertext"], encryption_key)
    except SecretUnsealError as error:
        raise MissingCredentialError(str(error)) from error

    return Credential(provider=provider, model=row["Model"], api_key=api_key)
