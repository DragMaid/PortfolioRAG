from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from itertools import chain
from typing import Any

from rag.corpus import SourceType
from rag.retrieval import Passage
from rag.schemas import source_type

logger = logging.getLogger(__name__)

_FIRST_DELAY = 1.0
_MAX_DELAY = 4.0
_TIMEOUT = 30.0


class ApiError(RuntimeError):
    """The API refused, or could not be reached. The message reaches the reader."""


class PortfolioApi:
    """A tiny client for the one account this token belongs to."""

    def __init__(self, base_url: str, token: str, *, wait_seconds: float = 180.0):
        self.base_url = base_url.rstrip("/")
        self.token = token.strip()
        self.wait_seconds = wait_seconds

    def retrieve(self, queries: list[str]) -> dict[str, Any]:
        """Queues a search and waits for it. Returns the worker's retrieval result."""
        job = self._request("POST", "/api/llm/retrieval", {"queries": queries})
        return self._await_job(job).get("retrieval") or {}

    def _await_job(self, job: dict[str, Any]) -> dict[str, Any]:
        deadline = time.monotonic() + self.wait_seconds
        delay = _FIRST_DELAY

        while job.get("status") in ("Queued", "Running"):
            if time.monotonic() > deadline:
                raise ApiError(
                    "The search is still queued after "
                    f"{int(self.wait_seconds)}s. Is the RAG worker running?"
                )

            # Exponential delay, limited by _MAX_DELAY to avoid spamming server
            time.sleep(delay)
            delay = min(_MAX_DELAY, delay * 1.25)
            job = self._request("GET", f"/api/llm/jobs/{job['id']}")

        if job.get("status") != "Succeeded":
            raise ApiError(job.get("error") or f"The search ended as {job.get('status')}.")

        return job

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base_url + path, data=data, method=method)
        request.add_header("Accept", "application/json")
        request.add_header("Authorization", f"Bearer {self.token}")

        if data is not None:
            request.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
                payload = response.read().decode()
        except urllib.error.HTTPError as error:
            raise ApiError(_problem(error)) from error
        except urllib.error.URLError as error:
            raise ApiError(
                f"Could not reach {self.base_url}: {error.reason}. Is the API running?"
            ) from error

        return json.loads(payload) if payload else {}


def _problem(error: urllib.error.HTTPError) -> str:
    """The API's problem+json turned into one line a person can act on."""
    try:
        problem = json.loads(error.read().decode())
    except Exception:
        problem = {}

    if error.code == 401:
        return "The API did not accept that token. Check it was copied whole."

    if error.code == 403:
        return (
            problem.get("detail")
            or "That token may not do this. A retrieval needs the write scope."
        )

    # chain.from_iterable flattens one level of nested iterables
    errors = problem.get("errors")
    flattened = chain.from_iterable(errors.values()) if isinstance(errors, dict) else iter(())
    # from_iterable return a iterable thats supposed to be consumed sequentially
    first = next(iter(flattened), None)

    return (
        first or problem.get("detail") or problem.get("title") or f"The API answered {error.code}."
    )


class ApiRetriever:
    """A :class:`rag.retrieval.Retriever` whose index lives behind the API.

    The whole of what the local pipeline borrows from the server. The searches go up, the
    passages come back, and everything the model is shown is in this response — so the same
    citation checking that protects the hosted path protects this one, against the same
    passages.
    """

    def __init__(self, api: PortfolioApi):
        self.api = api
        self._author_name = ""

    @property
    def author_name(self) -> str:
        return self._author_name

    def search(self, queries: list[str]) -> list[Passage]:
        result = self.api.retrieve(queries)
        self._author_name = result.get("authorName") or ""

        return [_passage(row) for row in result.get("passages", [])]


def _passage(row: dict[str, Any]) -> Passage:
    raw = row.get("sourceType")

    return Passage(
        document_id=int(row["documentId"]),
        source_type=source_type(raw) if isinstance(raw, str) else SourceType.POST,
        source_label=row.get("sourceLabel", ""),
        chunk_index=int(row.get("chunkIndex", 0)),
        content=row.get("content", ""),
        score=float(row.get("score", 0.0)),
        matched_queries=list(row.get("matchedQueries", [])),
    )
