"""Reading an author's portfolio out of the API's tables.

The module will only extract the following:

1. The profile: headline, biography, focus, location, availability. Short, and the only
   place the author describes themselves rather than a project.
2. Every job on the timeline: with its dates, making sure the LLM try its best to estimate
   user work experience
3. Published posts only: titles, body but not the media attached to those posts
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any

from psycopg import Connection

from .db import fetch_all, fetch_one


class SourceType(Enum):
    PROFILE = 0
    EXPERIENCE = 1
    POST = 2

@dataclass(slots=True)
class SourceDocument:
    """One thing worth indexing, before it is cut into passages."""

    source_type: SourceType
    source_id: int
    label: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def fingerprint(self) -> str:
        """A digest of everything that would change the passages cut from this."""
        material = f"{self.source_type}|{self.source_id}|{self.label}|{self.text}"
        return hashlib.sha256(material.encode("utf-8")).hexdigest()


def corpus_hash(documents: list[SourceDocument]) -> str:
    """A digest of the whole corpus, order-independent."""
    digests = sorted(document.fingerprint() for document in documents)
    return hashlib.sha256("".join(digests).encode("utf-8")).hexdigest()


def load(conn: Connection, author_id: int) -> list[SourceDocument]:
    """The author's whole indexable portfolio, as documents."""
    documents: list[SourceDocument] = []

    profile = _load_profile(conn, author_id)
    if profile is not None:
        documents.append(profile)

    documents.extend(_load_experiences(conn, author_id))
    documents.extend(_load_posts(conn, author_id))

    return documents


def _load_profile(conn: Connection, author_id: int) -> SourceDocument | None:
    row = fetch_one(
        conn,
        """
        SELECT "Id", "Name", "Title", "Headline", "Biography", "FooterBio",
               "Location", "Availability", "Focus"
        FROM "Authors"
        WHERE "Id" = %s
        """,
        (author_id,),
    )

    if row is None:
        return None

    # NOTE: use field here to make filtering explicit
    sections = [
        ("Name", row["Name"]),
        ("Current title", row["Title"]),
        ("Headline", row["Headline"]),
        ("Location", row["Location"]),
        ("Availability", row["Availability"]),
        ("Primary focus", row["Focus"]),
        ("Biography", row["Biography"]),
        ("Short bio", row["FooterBio"]),
    ]

    text = "\n".join(
        f"{label}: {value.strip()}"
        for label, value in sections
        if _present(value)
    )

    if not text:
        return None

    # NOTE: source id is Zero because an author has exactly one profile
    return SourceDocument(
        source_type=SourceType.PROFILE,
        source_id=0,
        label=f"{row['Name']} — profile",
        text=text,
        metadata={"section": "profile", "name": row["Name"]},
    )


def _load_experiences(conn: Connection, author_id: int) -> list[SourceDocument]:
    rows = fetch_all(
        conn,
        """
        SELECT "Id", "Company", "Role", "Team", "Description", "StartedOn", "EndedOn"
        FROM "Experiences"
        WHERE "AuthorId" = %s
        ORDER BY "StartedOn" DESC, "Id" DESC
        """,
        (author_id,),
    )

    documents = []

    for row in rows:
        period = _format_period(row["StartedOn"], row["EndedOn"])
        label = f"{row['Company']} — {row['Role']}"

        lines = [
            f"Company: {row['Company']}",
            f"Role: {row['Role']}",
            f"Period: {period}",
        ]

        if _present(row["Team"]):
            lines.append(f"Team: {row['Team'].strip()}")

        if _present(row["Description"]):
            lines.append("")
            lines.append(row["Description"].strip())

        documents.append(
            SourceDocument(
                source_type=SourceType.EXPERIENCE,
                source_id=row["Id"],
                label=label,
                text="\n".join(lines),
                metadata={
                    "company": row["Company"],
                    "role": row["Role"],
                    "period": period,
                    "started_on": _iso(row["StartedOn"]),
                    "ended_on": _iso(row["EndedOn"]),
                    "is_current": row["EndedOn"] is None,
                    "months": _months_between(row["StartedOn"], row["EndedOn"]),
                },
            )
        )

    return documents


def _load_posts(conn: Connection, author_id: int) -> list[SourceDocument]:
    rows = fetch_all(
        conn,
        """
        SELECT "Id", "Title", "Slug", "Summary", "Body", "Category", "Domain",
               "PublishedAt", "RepoUrl", "DemoUrl", "SpecUrl"
        FROM "Posts"
        WHERE "AuthorId" = %s AND "IsDraft" = false
        ORDER BY "PublishedAt" DESC NULLS LAST, "Id" DESC
        """,
        (author_id,),
    )

    documents = []

    for row in rows:
        lines = [f"Project: {row['Title']}"]

        if _present(row["Category"]):
            lines.append(f"Category: {row['Category'].strip()}")

        if _present(row["Domain"]):
            lines.append(f"Domain: {row['Domain'].strip()}")

        if _present(row["Summary"]):
            lines.append(f"Summary: {row['Summary'].strip()}")

        # NOTE: the links are indexed as text. "Is there public code" is a question a
        # posting asks constantly, and the presence of a repository URL is the answer.
        for name, value in (("Repository", row["RepoUrl"]), ("Live demo", row["DemoUrl"]),
                            ("Design document", row["SpecUrl"])):
            if _present(value):
                lines.append(f"{name}: {value.strip()}")

        lines.append("")
        lines.append((row["Body"] or "").strip())

        documents.append(
            SourceDocument(
                source_type=SourceType.POST,
                source_id=row["Id"],
                label=row["Title"],
                text="\n".join(lines).strip(),
                metadata={
                    "title": row["Title"],
                    "slug": row["Slug"],
                    "category": row["Category"],
                    "domain": row["Domain"],
                    "published_at": _iso(row["PublishedAt"]),
                    "has_repo": _present(row["RepoUrl"]),
                },
            )
        )

    return documents


def _present(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


def _format_period(started: date | None, ended: date | None) -> str:
    """"May 2019 — Sep 2021", or "— Present" for the job somebody is still doing."""
    start = started.strftime("%b %Y") if started else "?"
    end = ended.strftime("%b %Y") if ended else "Present"
    return f"{start} — {end}"


def _months_between(started: date | None, ended: date | None) -> int | None:
    """Tenure in whole months, so "three years of Rust" can be answered by arithmetic.

    The model is given this rather than being asked to subtract dates in its head, which is
    the sort of thing it will do confidently and occasionally wrongly.
    """
    if started is None:
        return None

    finish = ended or date.today()
    return max(0, (finish.year - started.year) * 12 + finish.month - started.month)
