"""Seeding the fixture portfolio into a scratch author.

The eval runs against a portfolio it controls, in a transaction it rolls back. Two reasons:
a suite whose results depend on whatever is in somebody's development database is not
measuring the pipeline, and an eval that leaves rows behind is one people stop running.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

FIXTURE_PATH = Path(__file__).parent / "datasets" / "portfolio.json"

# The account the fixture is written to. Deleted at the end of every run and again at the
# start of the next, so an interrupted run cannot poison the one after it.
FIXTURE_EMAIL = "eval-fixture@localhost.invalid"
FIXTURE_HANDLE = "eval-fixture"


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
        author_id = cursor.fetchone()["Id"]

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
                    ("AuthorId", "Title", "Slug", "Summary", "Body", "Category", "Domain",
                     "RepoUrl", "SpecUrl", "IsDraft", "IsFeatured",
                     "CreatedAt", "UpdatedAt", "PublishedAt", "ViewCount")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false, false,
                        now(), now(), %s, 0)
                """,
                (
                    author_id,
                    post["title"],
                    # Namespaced so the fixture cannot collide with a real post's slug,
                    # which is unique across the table rather than per author.
                    f"eval-{post['slug']}",
                    post.get("summary"),
                    post["body"],
                    post.get("category"),
                    post.get("domain"),
                    post.get("repo_url"),
                    post.get("spec_url"),
                    datetime(2024, 1, 1),
                ),
            )

    return author_id


def purge(conn: Connection) -> None:
    """Removes the fixture account. Cascades take its posts, timeline and index with it."""
    with conn.cursor() as cursor:
        cursor.execute('DELETE FROM "Authors" WHERE "Email" = %s', (FIXTURE_EMAIL,))
