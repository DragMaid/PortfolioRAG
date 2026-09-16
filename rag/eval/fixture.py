"""Seeding the fixture portfolio into a scratch author.

The eval runs against a portfolio it controls, in a transaction it rolls back. Two reasons:
a suite whose results depend on whatever is in somebody's development database is not
measuring the pipeline, and an eval that leaves rows behind is one people stop running.
"""

from __future__ import annotations

import base64
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from psycopg import Connection
from psycopg.rows import dict_row
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from rag.credentials import PROVIDER_NAMES
from rag.crypto import decode_encryption_key
from rag.providers import get_provider
from rag.settings import get_settings

FIXTURE_PATH = Path(__file__).parent / "datasets" / "portfolio.json"

# The account the fixture is written to. Deleted at the end of every run and again at the
# start of the next, so an interrupted run cannot poison the one after it.
FIXTURE_EMAIL = "eval-fixture@localhost.invalid"
FIXTURE_HANDLE = "eval-fixture"

# Name to stored int, inverted from the one mapping the worker reads credentials with.
_PROVIDER_IDS = {name: provider_id for provider_id, name in PROVIDER_NAMES.items()}


class EvalCredentialSettings(BaseSettings):
    """The provider key a full run seeds onto the fixture author, read from ``RAG_EVAL_*``.

    Kept out of ``rag.settings`` because only the eval writes a credential; the worker never
    should. Leave ``RAG_EVAL_API_KEY`` unset and no credential is seeded.
    """

    model_config = SettingsConfigDict(
        env_prefix="RAG_EVAL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_key: SecretStr | None = None
    provider: str = "anthropic"
    model: str | None = None


def load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def seed(conn: Connection) -> int:
    """Creates the fixture author and returns its id, replacing any previous one."""
    fixture = load_fixture()
    profile = fixture["profile"]

    purge(conn)

    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            INSERT INTO "Authors"
                ("Name", "Email", "Handle", "Title", "Headline", "Biography",
                 "Location", "Availability", "Focus", "CreatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            RETURNING "Id"
            """,
            (
                profile["name"],
                FIXTURE_EMAIL,
                FIXTURE_HANDLE,
                profile["title"],
                profile["headline"],
                profile["biography"],
                profile["location"],
                profile["availability"],
                profile["focus"],
            ),
        )

        
        row_dict = cursor.fetchone()
        assert row_dict is not None
        author_id = row_dict["Id"]

        for experience in fixture["experiences"]:
            cursor.execute(
                """
                INSERT INTO "Experiences"
                    ("AuthorId", "Company", "Role", "Team", "Description",
                     "StartedOn", "EndedOn", "CreatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                """,
                (
                    author_id,
                    experience["company"],
                    experience["role"],
                    experience.get("team"),
                    experience.get("description"),
                    date.fromisoformat(experience["started_on"]),
                    date.fromisoformat(experience["ended_on"])
                    if experience.get("ended_on")
                    else None,
                ),
            )

        for post in fixture["posts"]:
            cursor.execute(
                """
                INSERT INTO "Posts"
                    ("AuthorId", "Title", "Slug", "Summary", "Body",
                     "RepoUrl", "IsDraft", "IsFeatured",
                     "CreatedAt", "UpdatedAt", "PublishedAt", "ViewCount")
                VALUES (%s, %s, %s, %s, %s, %s, false, false,
                        now(), now(), %s, 0)
                """,
                (
                    author_id,
                    post["title"],
                    f"eval-{post['slug']}",
                    post.get("summary"),
                    post["body"],
                    post.get("repo_url"),
                    datetime(2024, 1, 1),
                ),
            )

    seed_credential(conn, author_id)

    return author_id


def seed_credential(conn: Connection, author_id: int) -> bool:
    """Writes ``RAG_EVAL_API_KEY`` as the fixture author's credential, if one is set.

    Sealed the way ``SecretProtector`` seals it, so the pipeline reads it back through the
    same ``rag.credentials.load`` path a real job takes. Returns whether a row was written.
    """
    eval_settings = EvalCredentialSettings()

    if eval_settings.api_key is None or not eval_settings.api_key.get_secret_value():
        return False

    provider = _PROVIDER_IDS.get(eval_settings.provider.strip().lower())

    if provider is None:
        raise ValueError(
            f"RAG_EVAL_PROVIDER is {eval_settings.provider!r}; expected one of "
            f"{sorted(_PROVIDER_IDS)}."
        )

    settings = get_settings()
    api_key = eval_settings.api_key.get_secret_value()
    encryption_key = decode_encryption_key(settings.encryption_key.get_secret_value())

    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO "LlmCredentials"
                ("AuthorId", "Provider", "KeyCiphertext", "KeyPreview", "Model",
                 "ValidatedAt", "IsPublicFitEnabled", "DailyVisitorLimit",
                 "MonthlyAccountLimit", "MonthlyBudgetUsd", "CreatedAt", "UpdatedAt")
            VALUES (%s, %s, %s, %s, %s, now(), false, 20, 500, 10, now(), now())
            """,
            (
                author_id,
                provider,
                _seal(api_key, encryption_key),
                _preview(api_key),
                eval_settings.model or get_provider(eval_settings.provider).default_model,
            ),
        )

    return True


def _seal(plaintext: str, key: bytes) -> str:
    """nonce | tag | ciphertext, base64 — the layout ``rag.crypto.unseal`` reads."""
    nonce = os.urandom(12)
    sealed = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    ciphertext, tag = sealed[:-16], sealed[-16:]
    return base64.b64encode(nonce + tag + ciphertext).decode("ascii")


def _preview(api_key: str) -> str:
    """Matches LlmCredentialService.Preview: first 7, an ellipsis, last 4."""
    if len(api_key) <= 11:
        return "•" * len(api_key)
    return f"{api_key[:7]}…{api_key[-4:]}"


def purge(conn: Connection) -> None:
    """Removes the fixture account. Cascades take its posts, timeline and index with it."""
    with conn.cursor() as cursor:
        cursor.execute('DELETE FROM "Authors" WHERE "Email" = %s', (FIXTURE_EMAIL,))
