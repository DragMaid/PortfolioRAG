"""Applying to jobs from a job board, on the strength of the portfolio.

    search      (board)  a board's listings for each configured search
    triage      (code)   drop what the ledger has seen, what the policy excludes, link-outs
    assess      (rag)    the job-fit pipeline, verdict and score computed in code
    decide      (code)   the policy's thresholds, never the model's opinion
    write       (rag)    the cover-letter pipeline, from the same portfolio
    answer      (LLM)    employer questions, from the candidate's stated facts only
    submit      (board)  fill, attach, submit — and record what happened in the ledger

Boards are adapters (``applier.boards``); nothing outside them knows a selector.
"""
