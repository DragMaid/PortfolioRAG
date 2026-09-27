"""JobStreet (SEEK Asia) — quick apply through the board's own form.

    /<keywords>-jobs[/in-<location>]?daterange=N&page=P    search
    /job/<id>                                               posting
    /job/<id>/apply/{choose-documents,role-requirements,profile,review,success}

Link-out postings (``isLinkOut`` in the page's server state) hand off to the employer's own
site and are never followed here: every one is different, and a form this has never seen is
exactly where a wrong answer gets submitted. They are assessed all the same, and a fit goes
to the manual queue, to be applied to in the person's own browser with the extension.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from playwright.sync_api import Error as PlaywrightError

from ...browser import BrowserSession, Timeout
from ...errors import (
    ApplierError,
    ChallengeError,
    FlowError,
    LoginRequiredError,
    NotApplicableError,
)
from ...forms import FieldHandle, fill, read_fields
from ...models import ApplyMethod, Listing, Posting, Probe, Resume, Search, Submission
from ..base import ApplyContext
from . import selectors as sel

_MAX_STEPS = 10
_CHALLENGE_TITLES = ("just a moment", "attention required", "verify you are human")


class JobStreet:
    name = "jobstreet"

    def __init__(self, region: str = "sg"):
        region = region.strip().lower()
        if not re.fullmatch(r"[a-z]{2}", region):
            raise ValueError(f"JobStreet region should be a country code like sg, not {region!r}")
        self.host = f"https://{region}.jobstreet.com"
        self.login_url = f"{self.host}/oauth/login"
        self._browser: BrowserSession | None = None

    def attach(self, browser: BrowserSession) -> None:
        self._browser = browser

    @property
    def browser(self) -> BrowserSession:
        if self._browser is None:
            raise RuntimeError("JobStreet.attach() was never called.")
        return self._browser

    def is_signed_in(self, *, navigate: bool = True) -> bool:
        page = self.browser.page

        # Check if on correct domain and potentially redirect
        if not page.url.startswith(self.host):
            if not navigate:
                return False
            self.browser.goto(self.host)

        # Check login from url
        if sel.LOGIN_URL.search(page.url):
            return False

        # Search for authenticated markers
        if (found := sel.AUTHENTICATED.search(page.content())) is not None:
            # group(0) capture the whole matched string
            # group(1) capture only the section inside parenthesis ()
            return found.group(1) == "true"

        # Check if there is any sign in link or not
        return page.locator(sel.SIGN_IN_LINK).filter(visible=True).count() == 0

    def ensure_signed_in(self) -> None:
        self._check_challenge()
        if not self.is_signed_in():
            raise LoginRequiredError(
                "JobStreet is not signed in. Sign in once with a visible window: "
                "applier login jobstreet"
            )

    def search(self, search: Search) -> Iterator[Listing]:
        """Search for all unique listings and return a generator object for listings."""
        seen: set[str] = set()

        for page_number in range(1, search.max_pages + 1):
            self.browser.goto(self._search_url(search, page_number))
            self._check_challenge()

            try:
                self.browser.poll(lambda: self.browser.page.locator(sel.CARD).count(), timeout=15)
            except Timeout:
                return  # past the last page, or no results at all

            fresh = 0
            # Search for the regex card marker and flatten into single list
            for card in self.browser.page.locator(sel.CARD).all():
                job_id = card.get_attribute("data-job-id")

                # If job already applied for then leave it be
                if not job_id or job_id in seen:
                    continue
                seen.add(job_id)
                fresh += 1

                yield Listing(
                    board=self.name,
                    job_id=job_id,
                    url=self._posting_url(job_id),
                    title=_text(card, sel.CARD_TITLE) or card.get_attribute("aria-label") or "",
                    company=_text(card, sel.CARD_COMPANY),
                    location=_text(card, sel.CARD_LOCATION),
                )

            # If there's no shit at all then return
            if not fresh:
                return

    def _search_url(self, search: Search, page_number: int) -> str:
        """Return the page url with replaced page_number."""
        if search.url:
            parts = urlsplit(search.url)
            query = dict(parse_qsl(parts.query))
            query["page"] = str(page_number)
            return urlunsplit(parts._replace(query=urlencode(query)))

        # Query builder from slugs to location filtering
        path = "/" + _slug(search.keywords).lower() + "-jobs"
        if search.location:
            path += "/in-" + _slug(search.location)

        query: dict[str, str] = {"page": str(page_number)}
        if search.date_range:
            query["daterange"] = str(search.date_range)
        return f"{self.host}{path}?{urlencode(query)}"

    def _posting_url(self, job_id: str) -> str:
        """Return specific job posting via id."""
        return f"{self.host}/job/{job_id}"

    def listing_for(self, url: str) -> Listing:
        """Extracting job_id from url and returning Listing object with it."""
        found = re.search(r"/job/(\d+)", url)
        if not found:
            raise ValueError(f"{url} is not a JobStreet posting URL (…/job/<id>).")
        job_id = found.group(1)
        return Listing(board=self.name, job_id=job_id, url=self._posting_url(job_id), title="")

    def fetch(self, listing: Listing) -> Posting:
        browser = self.browser
        browser.goto(listing.url)
        self._check_challenge()

        # Polling to wait for body content to load
        try:
            browser.poll(lambda: browser.page.locator(sel.DETAIL_BODY).count(), timeout=20)
        except Timeout:
            raise browser.fail(
                FlowError(f"Posting {listing.job_id} never showed its text.")
            ) from None

        # Extracting posting metadata
        page = browser.page
        source = page.content()
        posting = Posting(
            listing=listing,
            title=_text(page, sel.DETAIL_TITLE) or listing.title,
            company=_text(page, sel.DETAIL_COMPANY) or listing.company,
            description=page.locator(sel.DETAIL_BODY).first.inner_text().strip(),
            method=ApplyMethod.QUICK,
            apply_url=f"{self.host}/job/{listing.job_id}/apply",
        )

        # Modifying metadata for expired
        if _flag(source, listing.job_id, "isExpired"):
            posting.method, posting.reason = ApplyMethod.UNAVAILABLE, "the posting has expired"

        # External posts
        elif _flag(source, listing.job_id, "isLinkOut"):
            posting.method = ApplyMethod.EXTERNAL
            posting.reason = "applications go through the employer's own site"
            posting.apply_url = listing.url

        # Damn page is either broken or this is some prank
        elif page.locator(sel.DETAIL_APPLY).count() == 0:
            posting.method, posting.reason = ApplyMethod.UNAVAILABLE, "no apply button"

        return posting

    def apply(self, posting: Posting, context: ApplyContext) -> Submission:
        browser = self.browser
        job_id = posting.listing.job_id
        role = posting.title or posting.listing.title
        answers: dict = {}
        handled: list[str] = []

        browser.goto(f"{self.host}/job/{job_id}/apply", settle_ms=2500)
        resumes: list[str] = []

        for _ in range(_MAX_STEPS):
            self._check_challenge()
            step = self._step()

            # Screenshot for debugging
            if context.capture_steps:
                browser.capture(f"{job_id}-{step}")

            if step == "success":
                return Submission(submitted=True, answers=answers)

            # Handle getting stuck at a certain step
            if handled and handled[-1] == step and step != "review":
                raise browser.fail(FlowError(f"The {step} step would not move on."))
            handled.append(step)

            try:
                match step:
                    case "documents":
                        if context.probe:
                            resumes = self._resume_names()
                        self._documents(context.packet.cover_letter, context.packet.resume)

                    case "questions":
                        if context.probe:
                            # As far as a mock application goes. Nothing is answered here and
                            # nothing is continued past this step.
                            return Submission(
                                submitted=False,
                                probe=Probe(
                                    questions=[h.field for h in self._read_questions()],
                                    resumes=resumes,
                                    role=role,
                                    company=posting.company or posting.listing.company,
                                    url=posting.listing.url,
                                ),
                            )
                        answers |= self._questions(context, role)

                    case "review":
                        # For debugging for dry runs
                        if not context.submit:
                            artifacts = browser.capture(f"{job_id}-review-dry-run")
                            return Submission(submitted=False, answers=answers, artifacts=artifacts)

                        return self._submit(answers)

                # Every step that did not return still has to be got past, this one included:
                # "profile" asks nothing this should change and only needs passing. Calling
                # this inside `case _` instead would leave documents and questions filled in
                # and never submitted, and the next turn of the loop would report that the
                # step would not move on.
                self._continue(step)

            except ApplierError:
                raise

            except PlaywrightError as error:
                failure = browser.fail(FlowError(f"The {step} step failed: {error}"), error)
                failure.terminal = step == "review" and context.submit
                raise failure from error

        raise browser.fail(FlowError(f"The apply flow went past {_MAX_STEPS} steps."))

    def _step(self) -> str:
        """Which step the page is on. Waits out redirects; raises on anything unexpected."""
        browser = self.browser

        def recognise() -> str | None:
            page = browser.page
            if sel.LOGIN_URL.search(page.url):
                raise LoginRequiredError(
                    "JobStreet asked for a sign-in mid-apply. Run: applier login jobstreet"
                )

            # extract the last path keyword then find step from map
            # ex: https://example.com/checkout/shipping/?discount=1 => shipping
            segment = urlsplit(page.url).path.rstrip("/").rsplit("/", 1)[-1]
            if segment in sel.STEP_PATHS:
                return sel.STEP_PATHS[segment]

            text = page.locator("main, body").first.inner_text(timeout=5_000)

            # Already applied
            if sel.ALREADY_APPLIED.search(text):
                raise NotApplicableError("Already applied to this posting on JobStreet.")

            names = [page.title(), *page.locator("h1, h2").all_inner_texts()]
            stepper = page.locator(sel.STEPPER_CURRENT)
            if stepper.count():
                names.append(stepper.first.inner_text(timeout=2_000))
            for name in names:
                for pattern, step in sel.STEP_HEADINGS:
                    if pattern.search(name):
                        return step

            # Application submitted
            if sel.SUCCESS_TEXT.search(text):
                return "success"

            # Handle external sites
            if not urlsplit(page.url).netloc.endswith("jobstreet.com"):
                raise NotApplicableError(f"The apply button left JobStreet for {page.url}.")

            return None

        try:
            step = browser.poll(recognise, timeout=20)
        except Timeout:
            raise browser.fail(
                FlowError(f"Did not recognise this step of the apply flow ({browser.page.url}).")
            ) from None

        if step != "success":
            self._wait_until_drawn()
        return step

    def _wait_until_drawn(self) -> None:
        """Waits for the continue button to be shown first."""
        page = self.browser.page
        buttons = page.get_by_role("button", name=sel.CONTINUE).or_(
            page.get_by_role("button", name=sel.SUBMIT)
        )
        try:
            self.browser.poll(lambda: buttons.filter(visible=True).count(), timeout=20)
        except Timeout:
            return
        page.wait_for_timeout(500)

    def _documents(self, letter: str | None, resume: Resume) -> None:
        """The resume, then the cover letter — written, or left out when ``letter`` is None."""
        page = self.browser.page

        if upload := resume.upload:
            # Uploaded by an earlier application, can just pick now
            if not self._choose_resume(upload.name, exact=True):
                file_input = page.locator(sel.RESUME_FILE_INPUT).first
                if not file_input.count():
                    raise self.browser.fail(FlowError("JobStreet's resume upload was not found."))
                file_input.set_input_files(str(upload))

                # Waiting for the file upload to 
                try:
                    self.browser.poll(lambda: self._choose_resume(upload.name, exact=True), 60)
                except Timeout:
                    raise self.browser.fail(
                        FlowError(f"JobStreet never showed {upload.name} as uploaded.")
                    ) from None

        elif resume.select and not self._choose_resume(resume.select):
            raise self.browser.fail(
                FlowError(f"No resume on the JobStreet profile is named like {resume.select!r}.")
            )

        # Allow not sending any cover letter
        if letter is None:
            page.get_by_role("radio", name=sel.COVER_NONE).check(force=True)
            return

        page.get_by_role("radio", name=sel.COVER_WRITE).check(force=True)
        box = self.browser.poll(
            lambda: (
                page.locator("textarea").filter(visible=True).first
                if page.locator("textarea").filter(visible=True).count()
                else None
            ),
            timeout=10,
        )
        if box is None:
            raise self.browser.fail(
                FlowError("The cover letter box did not appear; JobStreet may have changed it.")
            )

        limit = box.get_attribute("maxlength")
        if limit and limit.isdigit() and len(letter) > int(limit):
            raise self.browser.fail(
                FlowError(f"The cover letter is {len(letter)} characters; JobStreet takes {limit}.")
            )
        box.fill(letter)

    def _resume_radios(self) -> list[tuple[str, object]]:
        """The resumes on the profile, as (file name, radio), leaving out "don't include"."""
        page = self.browser.page
        found = []
        for radio in page.locator(sel.RESUME_RADIOS).all():
            if radio.get_attribute("value") == sel.RESUME_NONE_VALUE:
                continue
            element_id = radio.get_attribute("id")
            label = page.locator(f"label[for='{element_id}']") if element_id else None
            name = label.first.inner_text().strip() if label is not None and label.count() else ""
            if name:
                found.append((name, radio))
        return found

    def _choose_resume(self, wanted: str, *, exact: bool = False) -> bool:
        """Checks the profile's resume named ``wanted`` (or containing it). False if none is."""
        folded = wanted.casefold()
        for name, radio in self._resume_radios():
            if name.casefold() == folded or (not exact and folded in name.casefold()):
                radio.check(force=True)  # type: ignore[attr-defined]
                return True
        return False

    def _read_questions(self) -> list[FieldHandle]:
        """Every question on the current step. Reads the page and changes nothing on it.

        Shared by filling the form in and by a probing run, which wants the questions and
        nothing else.
        """
        page = self.browser.page
        # The form that moves the flow on, not the first one: a header search is a form too.
        forms = page.locator("form").filter(has=page.get_by_role("button", name=sel.CONTINUE))
        root = forms.first if forms.count() else page.locator("body")
        handles = read_fields(root, prefix="q")

        # Jobstreet has this dumb feature where even though the form is labell not required
        # but there is still a watcher script which refuse to submit unless all fields are filled
        for handle in handles:
            if handle.field.kind != "file":
                handle.field.required = True
        return handles

    def _resume_names(self) -> list[str]:
        """The resumes already on the profile, read off the documents step.

        For setting up, so that choosing one is picking from a list rather than typing a
        filename from memory. Reads the page and changes nothing on it.
        """
        try:
            return list(dict.fromkeys(name for name, _ in self._resume_radios()))
        except PlaywrightError:
            # Setting up is not the place to fail over a list that is only a convenience.
            return []

    def _questions(self, context: ApplyContext, role: str) -> dict:
        """Handle filling in forms (except cover letter)."""
        page = self.browser.page
        handles: list[FieldHandle] = self._read_questions()

        try:
            answers = context.answerer.answer(handles, role=role)
        except ApplierError as error:
            raise self.browser.fail(error) from error

        by_id = {handle.field.id: handle for handle in handles}
        for field_id, answer in answers.items():
            fill(page, by_id[field_id], answer)

        return {by_id[key].field.label or key: value for key, value in answers.items()}

    def _continue(self, step: str) -> None:
        """Click on the continue button and wait for changes to occur."""
        page = self.browser.page
        before = page.url
        page.get_by_role("button", name=sel.CONTINUE).last.click()

        try:
            self.browser.poll(lambda: page.url != before, timeout=15)
        except Timeout:
            problems = [
                text.strip()
                for text in page.locator(sel.VALIDATION).filter(visible=True).all_inner_texts()
                if text.strip()
            ]
            detail = "; ".join(dict.fromkeys(problems))[:500] or "no message shown"
            raise self.browser.fail(FlowError(f"The {step} step was refused: {detail}")) from None

    def _submit(self, answers: dict) -> Submission:
        """Clicks submit and waits for the confirmation.

        From the click on, every failure is terminal: whether the application went is
        unknown, and a second submission to the same employer is the worse mistake. The
        ledger records it as unconfirmed for a human to check.
        """
        page = self.browser.page

        def sent() -> bool:
            if "success" in urlsplit(page.url).path:
                return True
            return bool(sel.SUCCESS_TEXT.search(page.locator("body").inner_text(timeout=5_000)))

        try:
            page.get_by_role("button", name=sel.SUBMIT).click()
            self.browser.poll(sent, timeout=45)
        except Timeout:
            error: ApplierError = self.browser.fail(
                FlowError("Submitted, but JobStreet never confirmed it. Check My Activity.")
            )
            error.terminal = True
            raise error from None
        except ApplierError as error:
            error.terminal = True
            raise
        except PlaywrightError as cause:
            error = self.browser.fail(FlowError(f"The submit click failed: {cause}"), cause)
            error.terminal = True
            raise error from cause

        return Submission(submitted=True, answers=answers)

    def submitted(self) -> bool:
        """Whether this page shows a sent application. Never navigates, never raises.

        Called against tabs a person is working in, so anything unreadable — mid-navigation,
        closed, still loading — is simply "not yet", to be asked again in a moment.
        """
        try:
            page = self.browser.page
            if "success" in urlsplit(page.url).path:
                return True
            text = page.locator("body").inner_text(timeout=2_000)
        except (ApplierError, PlaywrightError):
            return False

        return bool(sel.SUCCESS_TEXT.search(text) or sel.ALREADY_APPLIED.search(text))

    def _check_challenge(self) -> None:
        """Waits out a bot check — in a window, when there is nobody to see a hidden one.

        Some clear on their own in a few seconds. One that does not needs a person, so a
        headless browser is brought up where the check is and given five minutes.
        """
        def clear() -> bool:
            title = self.browser.page.title().lower()
            return not any(marker in title for marker in _CHALLENGE_TITLES)

        if clear():
            return
        try:
            self.browser.poll(clear, timeout=15)
            return
        except Timeout:
            pass

        self.browser.show("JobStreet wants a bot check solved")
        try:
            self.browser.poll(clear, timeout=300, interval=1)
        except Timeout:
            error = ChallengeError("JobStreet's bot check was not solved in five minutes.")
            raise self.browser.fail(error) from None


def _text(scope, selector: str) -> str | None:
    """Element search function with normalization."""
    found = scope.locator(selector).first
    if not found.count():
        return None
    return found.inner_text().strip() or None


def _slug(text: str) -> str:
    """Generate slug from text and urlsafe encoding them using built-in quote."""
    return quote("-".join(text.split()), safe="-")


def _flag(source: str, job_id: str, flag: str) -> bool:
    """Returns whether a source url match filter parameters."""
    found = sel.posting_flag(job_id, flag).search(source)
    return bool(found and found.group(1) == "true")
