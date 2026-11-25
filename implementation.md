# RepoMind --- MVP Implementation Instructions for Claude

## 1. Your role

Act as the implementation engineer for **RepoMind**, a page-aware GitHub
history assistant.

Build a working MVP that can be demonstrated before the wHACKiest 2026
hackathon. Follow this document and the existing repository. Do not
expand the product scope or invent features.

**Primary objective:** A user opens a public GitHub repository, opens
the RepoMind Chrome side panel, asks why a technical change was made,
and receives a concise answer supported by links to the relevant GitHub
discussions, pull requests, issues, and commits.

## 2. Product definition

GitHub shows what changed, but the reasoning behind changes is scattered
across pull requests, reviews, issues, commits, and discussions.

RepoMind reconstructs that reasoning.

### Required MVP features

1.  **Page-aware side panel**
    -   Detect the GitHub repository currently open in the active tab.
    -   Extract `owner` and `repo` from supported GitHub repository
        URLs.
    -   Open RepoMind in a Chrome side panel.
    -   Show the detected repository clearly.
    -   Allow the user to enter a question.
2.  **Repository history retrieval**
    -   Fetch relevant repository history through the GitHub GraphQL
        API.
    -   Include pull requests, PR descriptions, reviews, review
        comments, issue references, issue comments, and commits where
        available.
    -   Follow links between a PR, its linked issue, and associated
        commits when the API data provides those relationships.
    -   Cache fetched records in SQLite to reduce repeated GitHub API
        calls.
3.  **Evidence-backed Q&A**
    -   Retrieve the most relevant cached history records for the user's
        question.
    -   Send the question and retrieved evidence to the Gemini LLM API.
    -   Return an answer grounded only in the retrieved evidence.
    -   Include clickable GitHub source links for claims.
    -   If the evidence is insufficient, clearly say that the available
        repository history does not establish the reason. Never invent
        reasoning.

### Explicitly out of scope for this MVP

-   Private repository support.
-   Support for GitLab, Bitbucket, or other Git hosts.
-   A full repository codebase semantic search engine.
-   Automatic code modification, pull request creation, or issue
    creation.
-   User accounts, billing, subscriptions, team management, or
    analytics.
-   A decision timeline UI or MCP server.
-   Complex background indexing or large-scale distributed
    infrastructure.

Do not implement out-of-scope features unless the user explicitly
changes this instruction.

## 3. Required technology stack

Use this stack unless the existing project already contains a compatible
implementation. Do not add alternative frameworks without asking.

  Layer                   Technology
  ----------------------- -----------------------------------
  Browser extension       Chrome Extension Manifest V3
  Extension UI            React + TypeScript + Tailwind CSS
  Extension integration   Chrome Side Panel API
  Backend                 Node.js + TypeScript
  GitHub data             GitHub GraphQL API
  Database/cache          SQLite
  AI answers              Gemini API
  Deployment target       Render or Railway

Use one TypeScript language ecosystem across the extension and backend
where practical. Keep the extension thin: GitHub data fetching,
retrieval, caching, and LLM calls belong in the backend.

## 4. Architecture

Implement this request flow:

``` text
GitHub repository page
        |
        v
Chrome MV3 extension
- Detect owner/repo from tab URL
- Open side panel
- Collect user question
        |
        | POST /api/ask
        v
Node.js + TypeScript backend
        |
        +----> GitHub GraphQL API
        |      Fetch PRs, reviews, comments,
        |      linked issues and commits
        |
        +----> SQLite
        |      Cache repository records
        |      Store text chunks and embeddings
        |
        +----> Retrieval
        |      Select relevant evidence
        |
        +----> Gemini API
               Generate evidence-grounded answer
        |
        v
Backend response
- Answer
- Evidence items
- GitHub source URLs
- Confidence/evidence status
        |
        v
React side panel displays answer and links
```

Keep boundaries clear: - The extension must not contain GitHub or Gemini
secrets. - The backend owns all external API calls. - The backend must
validate repository identifiers and request input. - The LLM must
receive retrieved evidence, not an unrestricted instruction to guess
from general knowledge.

## 5. Implementation sequence

Work in the following order. Finish and verify each phase before moving
to the next. Prefer a small working implementation over incomplete
abstractions.

### Phase 0 --- Inspect the project

1.  Inspect the complete existing repository structure and read its
    README, package files, and relevant source files.
2.  Identify what is already implemented.
3.  Preserve working code and existing conventions.
4.  Do not overwrite files blindly.
5.  Before coding, provide a short plan listing:
    -   Existing components you will reuse.
    -   Files you will create or modify.
    -   Any blockers that require a decision.
6.  If no project exists, create a simple monorepo:

``` text
repomind/
  extension/
  backend/
  README.md
  .gitignore
  .env.example
```

Do not create unnecessary packages or services.

### Phase 1 --- Backend skeleton

Create a TypeScript Node.js backend with:

-   `GET /health` --- returns a simple healthy status.
-   `POST /api/ask` --- accepts a repository and a question.
-   Clear separation between route handlers, GitHub API access, database
    operations, retrieval, and Gemini generation.
-   Environment-variable configuration.
-   Input validation and useful error messages.

Use a request shape equivalent to:

``` json
{
  "owner": "example-owner",
  "repo": "example-repo",
  "question": "Why was this authentication flow changed?"
}
```

The response must have a predictable structure equivalent to:

``` json
{
  "answer": "The available evidence indicates ...",
  "evidenceStatus": "supported",
  "sources": [
    {
      "type": "pull_request",
      "title": "Update authentication flow",
      "url": "https://github.com/example-owner/example-repo/pull/12",
      "excerpt": "Relevant text from the source"
    }
  ]
}
```

Use `evidenceStatus: "insufficient"` when the retrieved records do not
support an answer. Do not return fabricated source URLs or records.

### Phase 2 --- GitHub GraphQL integration

1.  Use the GitHub GraphQL API from the backend.
2.  Read the GitHub token from a backend environment variable. Never
    expose it to the extension or commit it.
3.  Fetch a bounded, recent set of repository history records suitable
    for a hackathon demo.
4.  Prioritise:
    -   Pull request title, body, number, URL, and timestamps.
    -   PR reviews and review comments.
    -   Linked issues and their comments.
    -   Commits associated with pull requests, including commit messages
        and URLs.
    -   Issue references or cross-links when exposed by the API.
5.  Preserve each record's type, title, body/text, URL, timestamp, and
    relationship identifiers where available.
6.  Handle pagination deliberately. Set a reasonable page size and stop
    at a documented MVP limit. Do not silently claim that all repository
    history was fetched.
7.  Handle rate limits, permission errors, missing fields, and network
    failures. Return actionable errors.
8.  Do not scrape GitHub HTML pages.

Do not assume every PR has reviews, linked issues, or comments. Missing
relationships are normal and must be handled safely.

### Phase 3 --- SQLite cache and indexing

Use SQLite for a local backend cache.

Create the smallest schema that supports: - Repository identity
(`owner`, `repo`). - Fetched GitHub records. - Record type and GitHub
URL. - Record text and timestamps. - Relationships between PRs, issues,
and commits when known. - Text chunks and embeddings if embedding
retrieval is implemented. - Fetch/update timestamps to support cache
freshness.

Requirements: 1. Use parameterised database queries. 2. Avoid duplicate
records when the same GitHub item is fetched again. 3. Reuse cached
records when they are sufficiently fresh. 4. Provide a deliberate
refresh path for stale or missing repository data. 5. Keep the schema
and indexing logic simple and documented.

For retrieval, implement a small, understandable pipeline: 1. Convert
source records into text chunks while retaining their source metadata
and URL. 2. Generate embeddings using the configured Gemini embedding
API/model only if it is available in the chosen Gemini API setup. 3.
Store embeddings in SQLite and calculate similarity in backend code. 4.
Retrieve a small top-ranked set of evidence chunks for each question. 5.
If embeddings cannot be configured or verified, stop and report the
blocker rather than silently substituting an unrelated service or
pretending embeddings work. Ask before using a keyword-only fallback.

Do not add a vector database. SQLite is the MVP cache and storage layer.

### Phase 4 --- Evidence-grounded Gemini answers

1.  Call Gemini only from the backend.
2.  Keep the API key in a backend environment variable.
3.  Send Gemini:
    -   The user's question.
    -   Repository owner/name.
    -   The retrieved evidence excerpts.
    -   Each evidence item's source type, title, and URL.
4.  Use a strict system instruction equivalent to:

``` text
You are RepoMind, an assistant that explains the historical reasoning
behind changes in a GitHub repository.

Answer only from the supplied repository evidence.
Do not use outside knowledge to infer why a decision was made.
Do not invent events, people, dates, links, issue numbers, or motivations.
Distinguish explicit statements in the evidence from cautious interpretation.
Attach source references to the claims they support.
If the evidence does not establish the reason, say:
"The available repository history does not provide enough evidence to
determine why this change was made."
You may summarise evidence, but must not turn correlation into causation.
Return the requested structured response only.
```

5.  Require structured output that the backend validates before
    returning it.
6.  Every source in the answer must correspond to an item actually
    supplied to Gemini.
7.  If Gemini returns invalid JSON, unsupported URLs, or malformed
    output, handle it safely. Do not display fabricated citations.
8.  Never describe an answer as certain when evidence is weak or
    indirect.

### Phase 5 --- Chrome extension and side panel

Build the smallest usable Chrome MV3 extension.

Required behaviour: 1. Detect URLs matching
`https://github.com/{owner}/{repo}`. 2. Ignore non-repository pages and
invalid URL paths. 3. Extract and display `owner/repo`. 4. Provide an
extension action that opens the Chrome side panel. 5. Display: -
RepoMind name. - Detected repository. - A question input. - An Ask
button. - Loading and error states. - The generated answer. - Clickable
evidence links. 6. Send the question and repository identity to the
backend's `POST /api/ask`. 7. Make the backend URL configurable for
local development and deployment. 8. Use only the permissions and host
permissions needed for the implemented functionality. 9. Do not
manipulate GitHub's page DOM. Use the active tab URL and supported
extension APIs. 10. Do not add unrelated extension features.

The extension must remain usable if the current tab is not a supported
GitHub repository page: show a clear message explaining that the user
should open a repository.

### Phase 6 --- Integration and demo readiness

Test the full flow using at least one public GitHub repository with
enough PR/issue history to demonstrate linked reasoning.

Verify: 1. Extension detects the correct repository. 2. Side panel
opens. 3. A question reaches the backend. 4. Backend fetches or reuses
GitHub history. 5. Records are cached in SQLite. 6. Retrieval returns
relevant evidence. 7. Gemini generates an answer grounded in that
evidence. 8. The UI displays working GitHub source links. 9. An
unsupported question produces an insufficient-evidence response. 10. API
failures produce readable errors instead of a blank panel or crash.

Prepare a short demo sequence: 1. Open the selected public repository.
2. Open RepoMind. 3. Ask a question about a historical technical
decision. 4. Show the answer and open its cited PR/issue/review source.
5. Ask a question for which the repository has no evidence and show the
explicit insufficient-evidence response.

Keep a known-good repository cached before the demo. Also prepare
screenshots or a short screen recording as a backup. Do not fake a live
result.

## 6. Environment configuration

Create `.env.example` with placeholders only. At minimum document:

``` env
GITHUB_TOKEN=
GEMINI_API_KEY=
PORT=
DATABASE_PATH=
```

Add any additional variable only if the implementation actually requires
it.

Requirements: - Add `.env` and database files to `.gitignore`. - Never
write real credentials into source files, README examples, logs, or
commits. - Validate required environment variables at backend startup. -
Explain how to obtain and configure each required key. - The extension
must contain no secret keys.

## 7. Code quality and implementation rules

Follow these rules throughout:

1.  **Do not hallucinate APIs.** Verify actual GitHub GraphQL fields,
    Chrome extension APIs, and Gemini SDK/API usage against installed
    package types or official documentation before using them.
2.  **Do not invent dependencies.** Add only packages needed for the
    current phase. Explain why each new dependency is needed.
3.  **Do not silently change the stack.** Use the stack in Section 3. If
    a required tool is unavailable or incompatible, explain the exact
    blocker and ask before replacing it.
4.  **Do not fake functionality.** No hardcoded sample answers, fake
    repository data, fake citations, or simulated successful API calls
    in the real application.
5.  **Do not swallow errors.** Log useful server-side diagnostics
    without exposing tokens or secrets; show a clear user-facing error.
6.  **Do not over-engineer.** No microservices, queues, Redis,
    Kubernetes, authentication system, or vector database for this MVP.
7.  **Keep types explicit.** Define shared request/response and
    source-record types. Validate data received from external APIs.
8.  **Keep secrets server-side.** Never put GitHub or Gemini credentials
    in extension code.
9.  **Keep citations verifiable.** A citation URL must originate from a
    fetched GitHub record.
10. **Make incremental changes.** After each phase, run the relevant
    build, type-check, and tests. Fix errors before continuing.
11. **Do not claim a phase is complete unless it runs.** State what was
    tested and what remains unverified.
12. **Do not rewrite unrelated files.** Preserve existing project
    structure and working functionality.

## 8. Acceptance criteria

The MVP is complete only when all of the following are true:

-   [ ] A Chrome MV3 extension loads unpacked without manifest errors.
-   [ ] It recognises a supported GitHub repository URL.
-   [ ] Its side panel opens and displays the repository identity.
-   [ ] A user can submit a natural-language question.
-   [ ] The backend fetches real GitHub history using GraphQL.
-   [ ] The backend caches fetched records in SQLite.
-   [ ] Relevant evidence is retrieved for a question.
-   [ ] Gemini answers using only the retrieved evidence.
-   [ ] The answer includes working links to real GitHub sources.
-   [ ] The system explicitly reports insufficient evidence instead of
    guessing.
-   [ ] Errors and loading states are visible and understandable.
-   [ ] The project has setup instructions and an `.env.example`.
-   [ ] A complete end-to-end demo has been tested on a public
    repository.

## 9. Required final deliverables

When implementation is complete, provide:

1.  Working extension source.
2.  Working backend source.
3.  SQLite schema and cache/retrieval implementation.
4.  `.env.example` with no real secrets.
5.  README with exact local setup, run, build, and Chrome
    unpacked-extension loading steps.
6.  A short architecture explanation.
7.  A list of tested acceptance criteria and the actual test results.
8.  A list of known limitations and anything not completed.

Do not claim deployment unless it has actually been deployed and tested.

## 10. How to work with the user

-   Explain decisions briefly and in beginner-friendly language.
-   Work phase by phase; do not dump a huge amount of code without
    verifying it.
-   Before making a major architectural change, explain the reason and
    ask for approval.
-   If a requirement is ambiguous, ask one focused question rather than
    guessing.
-   If a required API, model, SDK, or field cannot be verified, state
    that clearly and stop that part of the implementation.
-   Prioritise a reliable end-to-end MVP over visual polish or extra
    features.

**Start now with Phase 0: inspect the existing project, report what is
already present, and propose the exact files and steps for Phase 1. Do
not start implementing until the inspection summary is provided.**
