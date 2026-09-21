"""JobStreet's page, as data. The part that rots.

The search and posting hooks are SEEK's own ``data-automation`` attributes, checked against
sg.jobstreet.com in September 2026. The apply flow sits behind a sign-in and is matched by
accessible name and visible text rather than by class or test id — what a person reads is
the part SEEK changes least. When a step stops matching, run a dry run with
``--capture-steps`` and look at the captured page.
"""

from __future__ import annotations

import re

# --- search results ---------------------------------------------------------
CARD = "article[data-job-id]"
CARD_TITLE = "[data-automation='jobTitle']"
CARD_COMPANY = "[data-automation='jobCompany']"
CARD_LOCATION = "[data-automation='jobLocation']"

# --- a posting ----------------------------------------------------------------
DETAIL_TITLE = "[data-automation='job-detail-title']"
DETAIL_COMPANY = "[data-automation='advertiser-name']"
DETAIL_BODY = "[data-automation='jobAdDetails']"
DETAIL_APPLY = "[data-automation='job-detail-apply']"
SIGN_IN_LINK = "[data-automation='sign in']"

# The posting's own record in the server state embedded in the page. Camoufox evaluates
# scripts in an isolated world, so ``window.SEEK_APOLLO_DATA`` is not readable from here;
# the page source is.
AUTHENTICATED = re.compile(r'"authenticated":(true|false)')


def posting_flag(job_id: str, flag: str) -> re.Pattern[str]:
    return re.compile(
        rf'"id":"{re.escape(job_id)}","title":.{{0,4000}}?"{flag}":(true|false)', re.DOTALL
    )


# --- the apply flow -----------------------------------------------------------
# Steps, by the last path segment of the apply URL, then by the page heading.
STEP_PATHS = {
    "choose-documents": "documents",
    "role-requirements": "questions",
    "profile": "profile",
    "review": "review",
    "success": "success",
}
STEP_HEADINGS = (
    (re.compile(r"choose documents", re.I), "documents"),
    (re.compile(r"employer questions|role requirements", re.I), "questions"),
    (re.compile(r"update .*profile", re.I), "profile"),
    (re.compile(r"review and submit", re.I), "review"),
    (re.compile(r"application (has been )?(sent|submitted)", re.I), "success"),
)
SUCCESS_TEXT = re.compile(r"application (has been |was )?(sent|submitted)", re.I)
ALREADY_APPLIED = re.compile(r"(you('ve| have) )?already applied", re.I)
LOGIN_URL = re.compile(r"/oauth/|/login|login\.seek|/sign-?in", re.I)

RESUME_UPLOAD = re.compile(r"upload a resum", re.I)
RESUME_SELECT = re.compile(r"select a resum", re.I)
COVER_WRITE = re.compile(r"write a cover letter", re.I)
CONTINUE = re.compile(r"^\s*continue\s*$", re.I)
SUBMIT = re.compile(r"submit application", re.I)

# Where a refused step says why.
VALIDATION = "[aria-invalid='true'], [role='alert'], [id$='-message'], [id*='error' i]"
