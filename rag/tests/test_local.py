"""The local pipeline's seam with the API.

No browser and no network here. What is worth testing is the join: that a passage off the
wire comes back as the passage the pipeline and the citation checker expect, and that a job
that fails upstream becomes a sentence rather than a traceback. The pipeline either side of
that seam is already covered by ``test_pipeline.py``, which runs the whole of it against a
stubbed provider.
"""

from __future__ import annotations

from typing import Any

import pytest

from rag.corpus import SourceType
from rag.local.api import ApiError, ApiRetriever, PortfolioApi
from rag.schemas import build_retrieval


class FakeApi(PortfolioApi):
    """A ``PortfolioApi`` whose one HTTP call is answered from a list."""

    def __init__(self, responses: list[dict[str, Any]]):
        super().__init__("http://api.test", "pfl_token")
        self.responses = responses
        self.requests: list[tuple[str, str, dict[str, Any] | None]] = []

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.requests.append((method, path, body))
        return self.responses.pop(0)


def _job(status: str, **rest: Any) -> dict[str, Any]:
    return {"id": "11111111-1111-1111-1111-111111111111", "status": status, **rest}


def _result(**overrides: Any) -> dict[str, Any]:
    return {
        "authorName": "Ada",
        "queries": ["replication"],
        "passages": [
            {
                "documentId": 7,
                "sourceType": "Post",
                "sourceLabel": "A storage post",
                "chunkIndex": 2,
                "content": "Built the replication layer.",
                "score": 0.42,
                "matchedQueries": ["replication"],
            }
        ],
        **overrides,
    }


def test_a_finished_search_becomes_passages_the_pipeline_can_use():
    api = FakeApi([_job("Succeeded", retrieval=_result())])
    retriever = ApiRetriever(api)

    passages = retriever.search(["replication"])

    assert api.requests == [("POST", "/api/llm/retrieval", {"queries": ["replication"]})]

    passage = passages[0]
    assert passage.document_id == 7
    # The enum is serialised by name on the way out and must land back on the enum, or the
    # report would label every citation a post.
    assert passage.source_type is SourceType.POST
    assert passage.chunk_index == 2
    assert passage.citation == "#7"
    assert passage.matched_queries == ["replication"]

    # The name the letter is signed with rides along with the passages.
    assert retriever.author_name == "Ada"


def test_a_queued_search_is_polled_until_it_finishes(monkeypatch):
    monkeypatch.setattr("rag.local.api.time.sleep", lambda _seconds: None)

    api = FakeApi([
        _job("Queued"),
        _job("Running"),
        _job("Succeeded", retrieval=_result()),
    ])

    assert len(ApiRetriever(api).search(["replication"])) == 1
    assert [method for method, _path, _body in api.requests] == ["POST", "GET", "GET"]


def test_a_failed_search_is_reported_in_the_words_the_api_used(monkeypatch):
    monkeypatch.setattr("rag.local.api.time.sleep", lambda _seconds: None)

    api = FakeApi([_job("Failed", error="Nothing is indexed for this portfolio yet.")])

    with pytest.raises(ApiError, match="Nothing is indexed"):
        ApiRetriever(api).search(["replication"])


def test_what_the_worker_writes_is_what_the_local_client_reads():
    """The wire contract, from both ends.

    ``build_retrieval`` is what the worker puts in ``RagJobs.ResultJson``; the API
    deserialises it into ``RetrievalResultDto`` and serialises that back out in camelCase.
    This asserts the round trip of the fields the pipeline actually depends on.
    """
    from rag.retrieval import Passage

    written = build_retrieval(
        author_name="Ada",
        queries=["replication"],
        passages=[
            Passage(
                document_id=7,
                source_type=SourceType.EXPERIENCE,
                source_label="Helio — Engineer",
                chunk_index=0,
                content="Owned the replication layer.",
                score=0.5,
                matched_queries=["replication"],
            )
        ],
    )

    assert written["author_name"] == "Ada"
    assert written["passages"][0]["source_type"] == "experience"

    # The API renames the keys but not the values. Read it back the way the client will.
    camel = {
        "authorName": written["author_name"],
        "queries": written["queries"],
        "passages": [
            {
                "documentId": row["document_id"],
                "sourceType": row["source_type"],
                "sourceLabel": row["source_label"],
                "chunkIndex": row["chunk_index"],
                "content": row["content"],
                "score": row["score"],
                "matchedQueries": row["matched_queries"],
            }
            for row in written["passages"]
        ],
    }

    passage = ApiRetriever(FakeApi([_job("Succeeded", retrieval=camel)])).search(["x"])[0]

    assert passage.source_type is SourceType.EXPERIENCE
    assert passage.source_label == "Helio — Engineer"
    assert passage.content == "Owned the replication layer."
