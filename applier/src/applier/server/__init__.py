"""The page, and the two things behind it.

``applier serve`` puts one server in front of both halves of this project:

* the **controller** (``/api/*``), which drives the boards — searching, assessing, filling
  forms, and handing the ones you asked to check over to you in a tab;
* the **local rag pipelines** (``/api/rag/*``), which are ``rag.local``'s own API, mounted
  here rather than reimplemented, so pasting a posting in for a job-fit report or a cover
  letter is the same code that a run uses to decide with.

They share one browser thread for the model, because a chat site's profile can only be open
once. See :func:`applier.server.app.create_app`.
"""

from .app import create_app

__all__ = ["create_app"]
