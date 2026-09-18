"""Turning text into vectors, locally.
bge-small-en-v1.5 through fastembed's ONNX runtime: 384 dimensions (~90MB)
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

# NOTE: The prefix bge-v1.5 was trained to see in front of a search.
# Applied to before the search queries and never to passages
_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "

# src/rag/embeddings.py -> the project root: rag/ in a checkout, /app in the image.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def cache_dir() -> Path:
    """Where the model's files live between processes.

    fastembed's own default is ``$TMPDIR/fastembed_cache``, which a reboot clears, so the
    model is fetched again. Instead, in order:

    1. ``FASTEMBED_CACHE_PATH`` — what the Dockerfile sets, and warms the model into.
    2. ``<project>/.cache/fastembed`` — the same place, relative to a checkout, so a worker
       run outside its container keeps the model beside the code (it is gitignored).
    3. ``$XDG_CACHE_HOME/fastembed`` — for an install that is not a checkout at all.
    """
    if configured := os.getenv("FASTEMBED_CACHE_PATH"):
        return Path(configured)

    if (_PROJECT_ROOT / "pyproject.toml").is_file():
        return _PROJECT_ROOT / ".cache" / "fastembed"

    xdg = os.getenv("XDG_CACHE_HOME") or Path.home() / ".cache"
    return Path(xdg) / "fastembed"


class Embedder:
    """The embedding model, loaded once per process."""

    def __init__(self, model_name: str, expected_dimensions: int, batch_size: int = 64):
        self.model_name = model_name
        self.batch_size = batch_size

        cache = cache_dir()
        logger.info(
            "Loading the embedding model.", extra={"model": model_name, "cache": str(cache)}
        )
        self._model = TextEmbedding(model_name=model_name, cache_dir=str(cache))
        # NOTE: this run embed small sample, iter and extract first embed to get dimension
        self.dimensions = len(next(iter(self._model.embed(["dimension probe"]))))

        if self.dimensions != expected_dimensions:
            raise RuntimeError(
                f"{model_name} produces {self.dimensions}-dimensional vectors but the "
                f"configuration says {expected_dimensions}. The database column has a fixed "
                "width, so one of the two has to change and the corpus has to be re-embedded."
            )

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        """Vectors for text being stored. No instruction prefix."""
        if not texts:
            return []

        return [vector.tolist() for vector in self._model.embed(texts, batch_size=self.batch_size)]

    def embed_query(self, text: str) -> list[float]:
        """A vector for something being searched for. Instruction-prefixed."""
        return self.embed_queries([text])[0]

    def embed_queries(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        prefixed = [f"{_QUERY_INSTRUCTION}{text}" for text in texts]

        return [
            vector.tolist() for vector in self._model.embed(prefixed, batch_size=self.batch_size)
        ]


@lru_cache(maxsize=2)
def get_embedder(model_name: str, dimensions: int, batch_size: int = 64) -> Embedder:
    """The process's embedder. Cached because loading it costs a second or two."""
    return Embedder(model_name, dimensions, batch_size)
