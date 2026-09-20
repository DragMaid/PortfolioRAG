# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Authors (primary account holders):** developers and technical creators. They sign up (email/password or Google), publish their projects, experience and write-ups in the studio (`/admin`), and are comfortable with API tokens, OpenAPI clients and bringing their own LLM provider key.
- **Portfolio visitors (most important audience of `/[handle]`):** recruiters and hiring managers screening candidates quickly. Their job is to judge fit — often against a specific posting, which they can paste into the job-fit check when the author has enabled it.
- **Prospective authors:** people arriving at `/`, deciding whether to sign up.

## Product Purpose

A multi-author platform: every author gets a public portfolio at their own handle, backed by a studio for writing and managing it. The platform handles the infrastructure (API, generated clients, retrieval over the author's work) so the author can focus on the work itself. Success is an author publishing a portfolio that lets a hiring manager judge fit quickly and credibly.

## Positioning

The portfolio can answer "does this person fit this job?" with evidence. Job-fit analysis checks a posting's requirements against the author's *published* work and cites the passage behind every claim; claims without surviving citations are demoted to "not shown" rather than stated fluently. Scoring is deterministic arithmetic, not a model's guess. The author's content is also available through a generated OpenAPI spec and type-safe TypeScript client, so they are not locked into the platform's UI.

## Operating Context

- Authors work in the studio: projects & Markdown editor, traffic & analytics, profile & presence (identity, avatar, experience, contact channels), access & tokens, and intelligence (LLM key, index status, exposure of job-fit, trial runs, cover letters).
- Visitors land on `/[handle]`: about, experience timeline, projects, and — only when the author has a working key and chose to expose it — the job-fit section.
- Job-fit runs cost the author money (their own provider key), are rate-limited per visitor, and read only what is published. The UI states all three before the visitor runs it.
- Analysis runs asynchronously: the API queues a job, a worker processes it, the browser polls for status.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router) + React 19 + Tailwind 4 frontend; ASP.NET API; Postgres + pgvector; Python RAG worker; MinIO for media. Frontend API clients are generated from OpenAPI (`npm run generate-api`).
- Shipped: multi-author portfolios at `/[handle]`, studio, email + Google sign-in (email sign-ups confirm the address with a six-digit code before they can publish; Google accounts skip it), API tokens, generated OpenAPI spec and TS client, page-view analytics, job-fit analysis, cover-letter generation (in progress on current branch).
- Internal, not author-facing products: the worker's hybrid dense + sparse retrieval exists only inside job-fit. It is not a public search or retrieval API.
- **Not shipped — do not claim:** edge distribution/caching, hybrid search as a feature, public/plug-and-play LLM retrieval endpoints. The current landing page claims these and is out of step with the product.
- Portfolio pages render per request so authors see published changes immediately.
- Open decision: the product name. "Portfolio" is a placeholder; do not invent a name.

## Evidence on Hand

- Real product behavior and architecture rationale: `../rag/README.md`.
- No testimonials, customer logos, user counts, benchmarks, pricing or press exist. Do not fabricate them. Landing-page sample data (e.g. the `sk_live_…` token in the terminal demo) is illustrative only.

## Product Principles

1. **Evidence over fluency.** Anything said about an author must trace to something they published; honesty beats a flattering claim.
2. **State costs and limits up front.** Tell people what something costs, how many runs they have and what it reads before they act, not after.
3. **Fast judgment for the visitor.** A hiring manager should get the shape of a person quickly, with depth available on demand.
4. **The author owns their content.** Open API and generated clients; no lock-in to platform markup.
5. **Claim only what ships.** Marketing copy follows the product, never leads it.

## Accessibility & Inclusion

No formal standard confirmed. The existing code already respects `prefers-reduced-motion`, handles touch vs. fine-pointer hover, and uses live regions for async status; keep to that bar.
