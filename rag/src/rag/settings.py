"""Everything this service reads from its environment.

Two of these have to agree with the API rather than being free choices, and both are called
out below: the encryption key, and the embedding model's width.
"""

from __future__ import annotations

import os
import socket
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration, read from ``RAG_*`` environment variables or a local ``.env``."""

    model_config = SettingsConfigDict(
        env_prefix="RAG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="postgresql://portfolio:portfolio@localhost:5433/portfolio",
        description="The same database the API writes to. There is no second store.",
    )

    pool_min_size: int = 1
    pool_max_size: int = 4

    # Worker
    worker_id: str = Field(
        default_factory=lambda: f"{socket.gethostname()}:{os.getpid()}",
        description="Recorded on every claimed job, so a stuck one can be traced to a process.",
    )

    poll_interval_seconds: float = Field(
        default=5.0,
        description=(
            "How long to wait for a NOTIFY before looking anyway. This is the safety net, "
            "not the delivery mechanism: a lost notification costs this much latency rather "
            "than a job that never runs."
        ),
    )

    lease_seconds: int = Field(
        default=600,
        description=(
            "How long a claim is good for. A worker that dies mid-job leaves its row Running; "
            "after this another worker may take it. Must comfortably exceed the slowest job, "
            "or a long analysis will be run twice."
        ),
    )

    max_backoff_seconds: int = 300

    # Encryption
    encryption_key: SecretStr = Field(
        default=SecretStr(""),
        description=(
            "Base64 of the 32 bytes the API sealed each author's provider key with — the "
            "value of Llm:EncryptionKey. The one setting that MUST match the API exactly: "
            "a mismatch is not a degraded mode, it is every job failing to unseal a key."
        ),
    )

    # Embeddings
    embedding_model: str = Field(
        default="BAAI/bge-small-en-v1.5",
        description="Runs locally through ONNX. No key, no network, no per-call cost.",
    )

    embedding_dimensions: int = Field(
        default=384,
        description=(
            "Must equal the width of the RagDocuments.Embedding column, which the migration "
            "fixed at 384. Changing the model means changing the column and re-embedding "
            "everything; the worker refuses to start rather than writing vectors the column "
            "will reject."
        ),
    )

    embedding_batch_size: int = 64

    # Chunking
    chunk_size: int = Field(default=900, description="Characters, not tokens. See rag.chunking.")
    chunk_overlap: int = 150
    min_chunk_chars: int = 120

    # Retrieval
    dense_k: int = Field(default=12, description="Passages the vector half returns per query.")
    sparse_k: int = Field(default=12, description="And the keyword half.")

    rrf_k: int = Field(
        default=60,
        description=(
            "The constant in reciprocal rank fusion. 60 is the value from the paper the "
            "method comes from and behaves well without tuning; it flattens the difference "
            "between ranks 1 and 2 enough that neither half of the search dominates."
        ),
    )

    mmr_lambda: float = Field(
        default=0.65,
        description=(
            "How much relevance is traded for variety when the shortlist is assembled. "
            "1.0 is pure relevance, which on a portfolio returns four chunks of the same "
            "post; lower brings in other projects at the cost of the very best passage."
        ),
    )

    context_passages: int = Field(
        default=24,
        description="How many passages reach the model. The prompt's size, and most of its cost.",
    )

    # Provider
    default_provider: str = "anthropic"
    default_model: str = "claude-opus-5"

    max_tokens: int = Field(
        default=16000,
        description=(
            "Generous: a truncated report is a wasted call, and only what is used is billed."
        ),
    )

    extraction_effort: str = Field(
        default="medium",
        description=(
            "Reading requirements out of a posting is close to extraction, and the top of the "
            "effort range buys little on it. The assessment below is the call that thinks."
        ),
    )

    assessment_effort: str = Field(default="high")

    request_timeout_seconds: float = 300.0
    max_retries: int = 3

    # Logging
    log_level: str = "INFO"
    log_json: bool = Field(
        default=False,
        description="One JSON object per line, for a deployment that ships logs somewhere.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The process's settings, read once."""
    return Settings()
