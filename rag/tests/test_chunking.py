"""The chunker's contract: nothing is lost, everything is attributable."""

from __future__ import annotations

from rag.chunking import Chunker
from rag.corpus import SOURCE_POST, SourceDocument


def document(text: str, label: str = "Vector Core") -> SourceDocument:
    return SourceDocument(source_type=SOURCE_POST, source_id=7, label=label, text=text)


def test_short_document_survives_as_one_passage():
    """The bug a naive length filter has: a document shorter than the floor vanishing.

    A two-line profile or a job with a one-sentence description is exactly the kind of
    thing a portfolio is full of, and dropping it silently removes a whole source from
    every answer.
    """
    chunks = Chunker(chunk_size=900, chunk_overlap=150, min_chars=120).split(
        document("Short, but real.")
    )

    assert len(chunks) == 1
    assert "Short, but real." in chunks[0].content


def test_every_chunk_carries_its_source():
    """A passage has to be attributable on its own — it is shown to the model alone."""
    body = "\n\n".join(
        f"Paragraph {index} about storage engines and replication." * 6 for index in range(8)
    )

    chunks = Chunker(chunk_size=300, chunk_overlap=50).split(document(body))

    assert len(chunks) > 1
    assert all(chunk.content.startswith("[Vector Core") for chunk in chunks)
    assert all(chunk.source_label == "Vector Core" for chunk in chunks)


def test_headings_are_carried_into_chunks():
    text = "# Vector Core\n\n## Design\n\n" + ("The index is an HNSW graph on disk. " * 40)

    chunks = Chunker(chunk_size=400, chunk_overlap=50).split(document(text))

    assert any("Design" in chunk.content.splitlines()[0] for chunk in chunks)


def test_no_content_is_dropped():
    """Every sentence of the input appears in some chunk.

    The property that matters most: a chunker that quietly loses the last paragraph of
    every document produces an index that is wrong in a way nothing downstream can detect.
    """
    sentences = [f"Fact number {index} is distinctive." for index in range(60)]
    text = " ".join(sentences)

    chunks = Chunker(chunk_size=300, chunk_overlap=60).split(document(text))
    combined = " ".join(chunk.content for chunk in chunks)

    for sentence in sentences:
        assert sentence in combined, f"lost: {sentence}"


def test_chunk_indexes_are_contiguous():
    """Index is the position in the source, and neighbours are found by arithmetic."""
    text = "A paragraph about ingest pipelines. " * 200

    chunks = Chunker(chunk_size=400, chunk_overlap=80).split(document(text))

    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))


def test_hash_changes_with_content_and_not_otherwise():
    """What makes re-indexing cheap. If this drifts, every run re-embeds the whole corpus."""
    chunker = Chunker()

    first = chunker.split(document("The write-ahead log is in Rust. " * 20))
    again = chunker.split(document("The write-ahead log is in Rust. " * 20))
    changed = chunker.split(document("The write-ahead log is in Go. " * 20))

    assert [c.content_hash for c in first] == [c.content_hash for c in again]
    assert [c.content_hash for c in first] != [c.content_hash for c in changed]


def test_renaming_a_source_changes_its_hashes():
    """The label is embedded with the passage, so a rename really is a different passage."""
    chunker = Chunker()

    before = chunker.split(document("Storage engine work. " * 30, label="Vector Core"))
    after = chunker.split(document("Storage engine work. " * 30, label="Vector Core v2"))

    assert before[0].content_hash != after[0].content_hash


def test_overlap_must_be_smaller_than_size():
    import pytest

    with pytest.raises(ValueError, match="chunk_overlap"):
        Chunker(chunk_size=100, chunk_overlap=100)
