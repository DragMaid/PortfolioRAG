"""``python -m rag`` runs the worker, which is what the container does."""

import sys

from .cli import worker

if __name__ == "__main__":
    sys.exit(worker())
