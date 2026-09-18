# The worker. Runs `rag-worker`, which drains the RagJobs queue.
#
# Two stages, for one reason worth the complexity: the embedding model is ~90MB and
# fastembed fetches it on first use. Downloading it at build time means a cold container
# starts answering immediately instead of fetching a model while a visitor waits.

FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies before source, so editing a prompt does not re-resolve the world.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY src ./src
COPY eval ./eval
COPY README.md ./
RUN uv sync --locked --no-dev


FROM python:3.13-slim AS runtime

# NOTE: no build toolchain in this stage. fastembed runs ONNX rather than torch, which is
# why the runtime image needs no compiler and no CUDA — the whole point of choosing it.
RUN useradd --create-home --uid 10001 worker

WORKDIR /app

COPY --from=builder --chown=worker:worker /app /app

# NOTE: WORKDIR creates /app as root, and --chown only touches what is copied into it. The
# cache directory below is written by the model warm-up two steps down, which runs as
# `worker`, so it has to exist and be owned before the USER switch.
RUN mkdir -p /app/.cache/fastembed && chown -R worker:worker /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FASTEMBED_CACHE_PATH=/app/.cache/fastembed

USER worker

# Warm the model into the image. A layer, not a volume: an image that cannot start without
# network access to a model host is an image that fails to start when that host is down.
RUN python -c "\
from rag.embeddings import get_embedder; \
from rag.settings import get_settings; \
s = get_settings(); \
get_embedder(s.embedding_model, s.embedding_dimensions)"

# Reports unhealthy if the process cannot reach the database or the vector column is not
# the width it was built for — the two conditions under which every job would fail.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "\
from rag.db import assert_embedding_column, get_pool, close_pool; \
from rag.settings import get_settings; \
s = get_settings(); \
c = get_pool(s).connection(); \
assert_embedding_column(c.__enter__(), s.embedding_dimensions); \
close_pool()" || exit 1

CMD ["rag-worker"]
