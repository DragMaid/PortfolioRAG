"""Retrieval over an author's portfolio, and the job-fit analysis built on it.

The service has exactly one job: drain the ``RagJobs`` queue the API writes to. Everything
else here — chunking, embedding, hybrid retrieval, the LangChain pipeline, the eval
harness — exists to serve one of the two job kinds.

Layout, roughly in the order a request moves through it:

``settings``    configuration, from the environment
``db``          the connection pool
``queue``       claiming, completing and failing jobs
``worker``      the loop; the only thing that knows about job kinds
``corpus``      reading the portfolio out of the API's tables
``chunking``    cutting it into retrievable passages
``embeddings``  turning passages into vectors, locally
``indexing``    keeping the two above in agreement with the database
``retrieval``   finding passages for a query — dense, sparse, fused, diversified
``pipeline``    the analysis itself
``citations``   checking that the analysis said only what the passages support
``scoring``     turning verified findings into a number, deterministically
"""

__all__ = ["__version__"]

__version__ = "0.1.0"
