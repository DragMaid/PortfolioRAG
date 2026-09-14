from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any

from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from .corpus import SourceDocument, SourceType


@dataclass(slots=True)
class Chunk:
    """One retrievable passage."""

    source_type: SourceType
    source_id: int
    source_label: str
    chunk_index: int
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        return sha256(self.content.encode("utf-8")).hexdigest()

    @property
    def key(self) -> tuple[SourceType, int, int]:
        return (self.source_type, self.source_id, self.chunk_index)


class Chunker:
    """Turns documents into passages, deterministically."""

    def __init__(
        self,
        chunk_size: int = 900,
        chunk_overlap: int = 150,
        min_chars: int = 120,
    ):
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size.")

        self.chunk_size = chunk_size
        self.min_chars = min_chars

        self._markdown_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=[
                ("#", "h1"),
                ("##", "h2"),
                ("###", "h3"),
                ("####", "h4"),
                ("#####", "h5"),
                ("######", "h6"),
            ],
            strip_headers=False,
        )

        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            keep_separator=True,
        )

    def split(self, document: SourceDocument) -> list[Chunk]:
        """The passages of one document, in order."""
        text = document.text.strip()

        if not text:
            return []

        # Split the markdown using headings for context first
        sections = self._markdown_splitter.split_text(text)

        # Split the markdown using recursive text splitter (character length based)
        pieces = self._splitter.split_documents(sections)

        # Merge parts that are too short with the record in front of it
        pieces = self._merge_runts(pieces)

        chunks: list[Chunk] = []

        for index, piece in enumerate(pieces):
            # Generate metadata into header hierchy h1 > h2 > h3 etc
            heading = self._heading_from_metadata(piece.metadata)
            content = self._with_context(
                document.label,
                heading,
                piece.page_content.strip(),
            )

            metadata = dict(document.metadata)
            metadata["source"] = document.label

            if heading:
                metadata["heading"] = heading

            chunks.append(
                Chunk(
                    source_type=document.source_type,
                    source_id=document.source_id,
                    source_label=document.label,
                    chunk_index=index,
                    content=content,
                    metadata=metadata,
                )
            )

        return chunks

    def split_all(self, documents: list[SourceDocument]) -> list[Chunk]:
        return [chunk for document in documents for chunk in self.split(document)]

    def _merge_runts(self, pieces: list) -> list:
        merged = []

        for piece in pieces:
            content = piece.page_content.strip()

            if not content:
                continue

            # if the content is too less, merge it with the last record instead
            if merged and len(content) < self.min_chars:
                merged[-1].page_content = f"{merged[-1].page_content.rstrip()}\n{content}"
            else:
                merged.append(piece)

        return merged

    @staticmethod
    def _heading_from_metadata(metadata: dict[str, Any]) -> str | None:
        headings = [
            metadata[key] for key in ("h1", "h2", "h3", "h4", "h5", "h6") if metadata.get(key)
        ]

        return " > ".join(headings) if headings else None

    @staticmethod
    def _with_context(
        label: str,
        heading: str | None,
        piece: str,
    ) -> str:
        # Use only label or add label into context(header) if heading is same as label
        header = label if not heading or heading == label else f"{label} > {heading}"
        return f"[{header}]\n{piece}"
