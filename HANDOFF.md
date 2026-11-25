# RepoMind — Developer Handoff Log

Each development session appends a new section to this file. Older sections must never be deleted or modified.

---

## Session 1: Backend Skeleton + Chrome Side Panel

- **Date:** 2026-11-25
- **Developers / Team:** Mohit & teammate
- **Focus:** Phase 0 (Inspect and Setup), Phase 1 (Backend Skeleton), Phase 5 (Chrome MV3 Extension & Side Panel)

### What Was Done

1. **Repository Setup:**
   - Synchronized with existing GitHub repository `https://github.com/Mohit117A/RepoMind` on branch `main`.
   - Preserved `implementation.md` as the definitive team specification.
   - Initialized root convenience scripts (`dev:backend`, `build:backend`, `build:extension`, `dev:extension`, `test`).
   - Configured `.gitignore` to strictly exclude secrets (`.env`, `.env.*`), build outputs (`dist/`, `build/`), `node_modules/`, and SQLite databases (`*.db`, `*.sqlite`, `backend/data/`).
   - Created `.env.example` with standard placeholders (`GITHUB_TOKEN`, `GEMINI_API_KEY`, `PORT`, `DATABASE_PATH`).

2. **Phase 1 — Backend Skeleton (`backend/`):**
   - Built Express application in TypeScript (`backend/src/app.ts`, `backend/src/server.ts`).
   - Centralized configuration in `backend/src/config.ts` with safe defaults (`PORT=3001`) and non-sensitive startup warnings when `GITHUB_TOKEN` or `GEMINI_API_KEY` are not set.
   - Defined strict Zod validation (`backend/src/lib/validate.ts`) for `owner` (max 39 alphanumeric/hyphen), `repo` (max 100 characters, no `.` or `..`), and `question` (3 to 500 chars). Unknown fields rejected.
   - Standardized error formatting (`backend/src/lib/errors.ts`) conforming to `{ "error": { "code": string, "message": string } }`.
   - Created routes:
     - `GET /health`: Returns `{ status: "ok", timestamp: ... }`.
     - `POST /api/ask`: Validates payload and returns honest HTTP 501 `not_implemented` (`"Repository history retrieval and AI answering are not implemented yet."`). No fake answers or fake sources.
   - Created architecture placeholder directories with READMEs for future phases:
     - `backend/src/github/` (Phase 2)
     - `backend/src/db/` (Phase 3)
     - `backend/src/retrieval/` (Phase 3)
     - `backend/src/llm/` (Phase 4)

3. **Phase 5 — Chrome MV3 Extension & Side Panel (`extension/`):**
   - Configured Chrome Manifest V3 (`extension/public/manifest.json`) using `sidePanel` and `tabs` permissions, and host permissions for `https://github.com/*` and `http://localhost:3001/*`.
   - Background service worker (`extension/src/background.ts`) configures `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so the side panel opens only on user toolbar click.
   - Generated clean PNG icons (16px, 48px, 128px) displaying navy rounded square with orange "R".
   - Implemented GitHub repository URL parser (`extension/src/lib/parseGithubUrl.ts`) with unit tests covering repository roots, PRs, issues, commits, query params, hash fragments, and non-repo/reserved segments.
   - Built React + Tailwind CSS side panel interface (`extension/src/sidepanel/`):
     - `Header`: Clean branding and version badge.
     - `RepoChip`: Dynamic detected repository display with prompt when not on a GitHub repo.
     - `QuestionForm`: Auto-validated textarea with 500-char counter, Enter to send, Shift+Enter for newline.
     - `StatusBanner`: Handles loading, offline backend ("RepoMind couldn't reach its server. Is the backend running?"), and feature not implemented (HTTP 501).
     - `AnswerCard` & `Sources`: Structured plain-text answer display with "Supported" / "Insufficient evidence" badge and verified clickable GitHub links (tested via component test).
   - Configured multi-entry Vite build outputting directly to `extension/dist`.

---

### What Was Tested & Actual Results

1. **Backend Unit & Integration Tests (Vitest + Supertest):**
   - Command: `cd backend && npm run test`
   - Results: **7 passed out of 7 tests**.
   - Verified:
     - `GET /health` returns status `ok` (HTTP 200).
     - `POST /api/ask` rejects invalid owner format (HTTP 400).
     - `POST /api/ask` rejects too-short question (HTTP 400).
     - `POST /api/ask` rejects unknown fields (HTTP 400).
     - `POST /api/ask` rejects `.` and `..` as repo name (HTTP 400).
     - `POST /api/ask` with valid payload returns HTTP 501 `not_implemented` (no fake data).
     - Unmapped routes return HTTP 404 `not_found`.

2. **Live Backend Server Execution:**
   - Started backend server on `http://localhost:3001`.
   - Verified with curl/HTTP requests:
     - `GET /health` -> HTTP 200 `{"status":"ok","timestamp":"..."}`
     - `POST /api/ask` (invalid) -> HTTP 400 `{"error":{"code":"bad_request","message":"..."}}`
     - `POST /api/ask` (valid) -> HTTP 501 `{"error":{"code":"not_implemented","message":"Repository history retrieval and AI answering are not implemented yet."}}`

3. **Extension Unit Tests (Vitest):**
   - Command: `cd extension && npm run test`
   - Results: **15 passed out of 15 tests**.
   - Verified:
     - `parseGithubUrl` URL parsing, edge cases, protocol checks, and reserved route filtering.
     - Answer and Source citation type contracts and payload structures.

4. **Extension Production Build:**
   - Command: `npm run build:extension`
   - Result: Successful compilation. All manifest files (`manifest.json`, `background.js`, `sidepanel.html`, `assets/sidepanel.js`, `assets/sidepanel.css`, `icons/*`) verified in `extension/dist`.
   - Checked `dist/` for secrets: Zero API keys or tokens present.

---

### What Is NOT Done or Unverified

- **Phase 2 (GitHub GraphQL):** GitHub GraphQL queries, pagination, and token-based client are NOT yet implemented.
- **Phase 3 (SQLite Cache & Embeddings):** SQLite database schema, caching tables, and embedding retrieval are NOT yet implemented.
- **Phase 4 (Gemini LLM):** Gemini API SDK integration and grounded prompt pipeline are NOT yet implemented.
- **Production Extension Deployment:** Extension tested locally in unpacked mode; not published to Chrome Web Store.

---

### Known Issues & Quirks

- `supertest` spins up local ephemeral sockets during tests: On Windows environments without network/port binding permission in sandboxed mode, tests must run with bypass sandbox enabled.
- Vite build produces extension assets in `dist/`. After modifying extension source, the extension must be rebuilt (`npm run build:extension`) and reloaded in Chrome (`chrome://extensions` reload button).

---

### Commands to Run the Project

```powershell
# 1. Start the backend in watch mode
npm run dev:backend

# 2. Build the extension into extension/dist
npm run build:extension

# 3. Watch extension files and auto-rebuild
npm run dev:extension

# 4. Run all tests
npm run test
```

---

### Environment Variables Needed So Far

- `PORT` (optional, default: `3001`): Backend server listening port.
- `VITE_BACKEND_URL` (optional, default: `http://localhost:3001`): Extension backend target.
- `GITHUB_TOKEN` and `GEMINI_API_KEY`: Not required in Session 1 (warnings are logged, but server operates normally).

---

### Next Task: Phase 2 (GitHub GraphQL) & Phase 3 (SQLite & Retrieval)

When the next developer begins, follow `implementation.md`:
1. **Phase 2 — GitHub GraphQL Integration:**
   - Read `GITHUB_TOKEN` from environment (required for GraphQL).
   - IMPORTANT: Verify exact GraphQL field names and schema against GitHub's official GraphQL documentation before writing queries.
   - Fetch bounded recent history (PRs, descriptions, review comments, linked issues, associated commits).
   - Implement pagination with explicit limit; do not scrape HTML.
2. **Phase 3 — SQLite Cache & Indexing:**
   - Select a SQLite library (e.g. `better-sqlite3` or `sqlite3`) and **verify that it installs and builds successfully on Windows and macOS** before relying on it (check native bindings).
   - Parameterized queries only; avoid duplicate records.
   - **Gemini Embedding Retrieval Warning:** The Gemini embedding model/API must be verified before use. If embeddings cannot be configured or verified, stop and ask the user before falling back to keyword search, as mandated in `implementation.md`.


---

## Session 2: GitHub GraphQL Integration + SQLite Cache & Retrieval Pipeline

- **Date:** 2026-11-25
- **Developers / Team:** Mohit & teammate
- **Focus:** Phase 2 (GitHub GraphQL Integration), Phase 3 (SQLite Cache, Chunking, and Gemini Embedding Retrieval), Developer Verification Tools (`npm run ingest`, `npm run retrieve`)

### What Was Done

1. **Phase 2 — GitHub GraphQL Integration (`backend/src/github/`):**
   - Verified GitHub GraphQL API fields against official schema and real public repositories (`fastify/fastify`).
   - Implemented GraphQL query (`backend/src/github/queries.ts`) fetching PRs, author logins, states, timestamps, closing issues references (`closingIssuesReferences`), issue comments, reviews, inline review comments, top-level discussion comments, and associated commits (`commits` -> `oid`, `message`, `url`, `committedDate`).
   - Built normalizer (`backend/src/github/normalize.ts`) mapping raw GraphQL nodes to structured domain types (`NormalizedRecord`, `NormalizedRelationship`), generating deterministic identifiers (`pr-123`, `issue-456`, `commit-abc1234`), preserving authentic GitHub URLs, safely handling null/empty connections, and tracking truncation (`isTruncated`).
   - Implemented `GitHubGraphQLClient` (`backend/src/github/client.ts`) using Node native `fetch` with comprehensive typed error handling (missing token 401, bad token 401, rate limit 429 with reset time, repo not found / inaccessible 404, GraphQL `errors` array, network errors 503, timeout 504). `GITHUB_TOKEN` is read strictly from backend environment and never logged.

2. **Phase 3 — SQLite Cache & Database Layer (`backend/src/db/`):**
   - Selected and verified `better-sqlite3` (`v13.2.0`), proving successful installation and synchronous execution on Node `v24.22.0`.
   - Designed normalized schema (`backend/src/db/schema.ts`):
     - `repositories`: tracks repository identity, fetch timestamps, truncation flag, PR counts.
     - `records`: unique records table with conflict resolution upserting existing IDs rather than duplicating.
     - `record_relationships`: links PRs to issues, reviews, comments, and commits.
     - `chunks`: text chunks with source type, title, verified URL, timestamp, and index.
     - `embeddings`: chunk vector embeddings indexed by `chunk_id`.
   - Implemented `RepositoryDatabase` (`backend/src/db/database.ts`) with idempotent schema initialization, safe directory creation, parameterized queries, WAL mode, foreign keys, and 24-hour freshness TTL (`isFresh`).

3. **Phase 3 — Chunking, Gemini Embeddings, and Retrieval (`backend/src/retrieval/`):**
   - Implemented chunker (`backend/src/retrieval/chunker.ts`) splitting records into overlapping chunks (`CHUNK_MAX_CHARS: 800`, `CHUNK_OVERLAP_CHARS: 100`) respecting word boundaries and prepending origin metadata and authentic URLs.
   - Verified Google Gemini Embedding API: confirmed active model is `models/gemini-embedding-001` producing 3072-dimensional vector embeddings via REST endpoint.
   - Implemented `GeminiEmbedder` (`backend/src/retrieval/embedder.ts`) with typed error handling for missing/invalid keys, rate limits, and network errors.
   - Implemented `cosineSimilarity` (`backend/src/retrieval/similarity.ts`) computing cosine similarity across vector embeddings in backend code without external vector database dependencies.
   - Built `HistoryRetriever` (`backend/src/retrieval/retriever.ts`) orchestrating repository ingestion, caching, and top-K evidence retrieval.

4. **Developer Verification Tooling & CLI (`backend/src/cli/`):**
   - Created `backend/src/cli/ingest.ts` (`npm run ingest -- <owner> <repo> [--refresh]`) to fetch, normalize, cache, chunk, embed, and print detailed counts.
   - Created `backend/src/cli/retrieve.ts` (`npm run retrieve -- <owner> <repo> "<question>"`) to embed queries and output top-K evidence items with similarity scores, titles, URLs, and excerpts.
   - Added root convenience scripts in `package.json` (`npm run ingest -- ...`, `npm run retrieve -- ...`).
   - Maintained honest HTTP 501 `not_implemented` for `POST /api/ask` pending Phase 4.

---

### What Was Tested & Actual Results

1. **Unit & Integration Tests (Vitest):**
   - Command: `npm run test`
   - Results: **40 passed out of 40 tests across both packages (100% passing)**.
   - Backend: **25 passed out of 25 tests** (`backend/src/app.test.ts`, `backend/src/github/client.test.ts`, `backend/src/github/normalize.test.ts`, `backend/src/db/database.test.ts`, `backend/src/retrieval/retriever.test.ts`).
     - Normalization of full PRs with linked issues, reviews, comments, and commits.
     - Safe handling of null/empty connections and PRs without reviews or issues.
     - Truncation flag behavior.
     - GitHub client error mappings: 401 missing/invalid token, 429 rate limit, 404 repo not found, 503 network error.
     - SQLite schema initialization, idempotency (duplicate fetches update instead of insert duplicates), and freshness TTL logic.
     - Chunking preserving URL metadata and word boundary splitting.
     - Cosine similarity vector mathematics.
     - Retriever ingest cache reuse (subsequent ingest reuses SQLite without refetching).
     - Top-K evidence ranking with mock embeddings.
   - Extension: **15 passed out of 15 tests** (`AnswerCard.test.ts`, `parseGithubUrl.test.ts`).

2. **TypeScript Compilation & Build Verification:**
   - Backend TypeScript build: `cd backend && npm run build` -> 0 errors, compiled cleanly to `dist/`.
   - Extension Vite production build: `npm run build:extension` -> compiled cleanly into `extension/dist/`.

3. **Live Verification Against Real Public Repository (`fastify/fastify`):**
   - Command: `npm run ingest -- fastify fastify`
     - Successfully fetched recent history via GitHub GraphQL.
     - Ingested 20 Pull Requests, 4 Linked Issues, 15 Reviews, 13 Comments, 22 Commits (74 Total Records).
     - Chunked records into 132 text chunks.
     - Successfully embedded all 132 chunks via Gemini API (`gemini-embedding-001`, 3072 dimensions) and cached in SQLite.
   - Cache Reuse Verification:
     - Ran `npm run ingest -- fastify fastify` a second time.
     - Result: `Cache Status: Reused existing cache (Fresh)` in 0.8s, zero refetching, zero duplicate rows.
   - Live Retrieval Verification (Relevant Question):
     - Command: `npm run retrieve -- fastify fastify "Why was schema validation or null content handling changed?"`
     - Result: Returned top 5 evidence items with high similarity (scores up to 0.7185) accurately matching PR #7267, Issue #7246, and related commits fixing the schema content null dereference bug, with verified GitHub URLs.
   - Live Retrieval Verification (Unrelated Question):
     - Command: `npm run retrieve -- fastify fastify "Why did we switch the rendering engine from React to Vue?"`
     - Result: Similarity dropped significantly (scores 0.56-0.57 for unrelated ecosystem plugin cleanup), correctly reflecting low evidence.

---

### What Is NOT Done or Unverified

- **Phase 4 (Gemini Evidence-Grounded Answering):** LLM prompt engineering, calling Gemini with retrieved evidence chunks, validating structured JSON responses, and end-to-end wiring to `POST /api/ask` are NOT yet implemented.
- **Phase 6 (Demo Readiness):** End-to-end side panel demo connecting the extension UI to the backend response is scheduled after Phase 4.

---

### Known Issues & Quirks

- `better-sqlite3` uses native bindings: verified functional on Linux x64 with prebuilt binaries. Standard prebuilt binaries are available for Windows and macOS.
- Gemini API embedding model name: `models/gemini-embedding-001` is the current supported model for `embedContent` on v1beta API (`text-embedding-004` is deprecated/unavailable on v1beta for this API version).

---

### Commands to Run the Project

```bash
# 1. Start the backend in watch mode
npm run dev:backend

# 2. Ingest repository history into local SQLite cache
npm run ingest -- <owner> <repo> [--refresh]

# 3. Retrieve top-K evidence for a question
npm run retrieve -- <owner> <repo> "<question>"

# 4. Build extension into extension/dist
npm run build:extension

# 5. Run all tests
npm run test
```

---

### Environment Variables Needed So Far

- `PORT` (optional, default: `3001`): Backend server listening port.
- `DATABASE_PATH` (optional, default: `backend/data/repomind.db`): Local SQLite database file path.
- `GITHUB_TOKEN` (required for `npm run ingest`): GitHub Personal Access Token with public repository read access.
- `GEMINI_API_KEY` (required for embeddings and Phase 4): Google Gemini API key from Google AI Studio.
- `VITE_BACKEND_URL` (optional, default: `http://localhost:3001`): Extension backend target.

---

### Next Task: Phase 6 (End-to-End Demo Integration & Side Panel Connection)

---

## Session 4: Phase 4 — Evidence-Grounded Gemini Answers

- **Date:** 2026-11-26
- **Developers / Team:** Mohit & teammate
- **Focus:** Phase 4 (Evidence-Grounded Gemini Answers per `implementation.md`), Wiring `POST /api/ask`, Concurrency Deduplication, Live Verification

### What Was Done

1. **Model Configuration:**
   - Added `GEMINI_MODEL` to centralized configuration (`backend/src/config.ts`) and `.env.example`.
   - Default model configured as `gemini-3.5-flash-lite` (selected after user approval and verified active on the user's API key; stays fully configurable via environment variable).
   - API key sent via `x-goog-api-key` header; no temperature, top_p, or top_k parameters sent.
   - For HTTP 503 from `generateContent`, automatically retries at most 2 times with a short delay before returning a clear `"AI model is busy, try again"` error (`AppError` 503).

2. **Evidence Enhancement & PR State Normalization:**
   - Enhanced PR record normalization (`backend/src/github/normalize.ts`) to store explicit PR states (`OPEN`, `CLOSED`, `MERGED`) directly in stored text, preventing unmerged PRs from being described as merged changes.
   - Updated retrieval pipeline (`backend/src/retrieval/retriever.ts`):
     - Gives Gemini the full chunk text (`fullText`), not truncated preview.
     - Keeps only the best chunk per record (deduplication by `recordId`).
     - Skips records with an empty body.
     - Uses saved SQLite relationships (`record_relationships`) to expand top matches with linked issues, reviews, comments, and commits up to 12 total items.
     - Excerpt presented to users (`extractBodyText`) strips metadata headers to display pure body text.

3. **Gemini Answer Generation (`backend/src/llm/generator.ts`):**
   - Enforced strict system instruction from `implementation.md` Phase 4, warning that evidence is untrusted data and forbidding prompt injection or outside inferences.
   - Numbered evidence items provided to Gemini; Gemini responds with structured JSON: `{ answer: string, evidenceStatus: "supported" | "insufficient", citedIds: number[] }`.
   - Validated LLM output using Zod (`GeminiOutputSchema`).
   - Grounding guarantees:
     - Built citations strictly from backend-supplied evidence; unknown IDs dropped.
     - Rejects URLs written in the answer text (falls back to insufficient evidence).
     - If `evidenceStatus === 'supported'` but citations are missing/empty, or if `evidenceStatus === 'insufficient'`, returns exact sentence:
       `"The available repository history does not provide enough evidence to determine why this change was made."` and `sources: []`.
     - When evidence is empty, returns the insufficient response immediately without invoking Gemini.
     - Sanitized error reporting: API keys are never logged or leaked in error responses.

4. **Endpoint Wiring (`POST /api/ask` in `backend/src/routes/ask.ts`):**
   - Replaced old HTTP 501 with real pipeline: Ingestion (or SQLite cache hit) -> Retrieval -> Grounded generation -> Returns `AskResponse`.
   - Added in-memory concurrency map (`pendingIngests`) to deduplicate simultaneous requests for the same repository so concurrent queries wait for the running ingest instead of spawning duplicates.

---

### What Was Tested & Actual Results

1. **Unit & Integration Tests (Mocked API calls):**
   - Commands: `npm test`
   - Backend: **40 passed out of 40 tests** (all 6 test files passing: `app.test.ts`, `generator.test.ts`, `normalize.test.ts`, `client.test.ts`, `database.test.ts`, `retriever.test.ts`).
   - Extension: **15 passed out of 15 tests**.
   - Verified:
     - Supported answer with valid citations.
     - Insufficient evidence response with exact fallback sentence and empty sources.
     - Dropping of unknown citation IDs.
     - Rejection of URLs written in answers.
     - Malformed JSON candidate handling (`malformed_output`).
     - Gemini API error handling without key leakage.
     - 503 retry logic (2 retries then "AI model is busy, try again").
     - Immediate insufficient fallback when evidence is empty without calling Gemini.
     - Concurrent request ingest deduplication on `POST /api/ask`.

2. **TypeScript Compilation & Production Builds:**
   - `npm run build:backend`: 0 errors, compiled cleanly.
   - `npm run build:extension`: 0 errors, built extension assets into `extension/dist/`.

3. **Live Verification Against Real Repository (`fastify/fastify`):**
   - Cache refresh: `npm run ingest -- fastify fastify --refresh`
     - Successfully ingested 74 records, 132 chunks, and 132 embeddings into SQLite cache.
   - **Query A (Supported change):**
     - Request: `"Why does Fastify now report a missing schema for null content entries?"`
     - Status: HTTP 200 (Time: 2713ms)
     - Answer: *"Previously, a null or undefined entry in a route schema content map caused startup to crash with a raw TypeError (Cannot read properties of null (reading 'schema')) instead of reporting an error code. Fastify now reports this as a missing schema by using optional chaining on the content-map dereferences, allowing the existing FST_ERR_SCH_CONTENT_MISSING_SCHEMA error path to handle null entries in the same way as empty entries."*
     - Sources cited:
       - `https://github.com/fastify/fastify/pull/7267`
       - `https://github.com/fastify/fastify/issues/7246`
       - `https://github.com/fastify/fastify/pull/7247`
     - Check: Verified all cited URLs directly support the answer; PR state is accurately tagged (`State: OPEN`).
   - **Query B (Insufficient evidence / counterfactual):**
     - Request: `"Why did Fastify switch its rendering engine from React to Vue?"`
     - Status: HTTP 200 (Time: 8371ms)
     - Answer: *"The available repository history does not provide enough evidence to determine why this change was made."*
     - EvidenceStatus: `"insufficient"`
     - Sources: `[]`

---

### Known Issues & Quirks

- `gemini-3.8-flash` experienced upstream Google API 503 spikes; `gemini-3.5-flash-lite` was selected and configured as the verified responsive default model.
- Windows test runner: `npm test` runs smoothly with network access permitted for `supertest` local ephemeral socket bindings.

---

### Commands to Run the Project

```bash
# 1. Start the backend in watch mode
npm run dev:backend

# 2. Ingest repository history into local SQLite cache
npm run ingest -- <owner> <repo> [--refresh]

# 3. Retrieve top-K evidence for a question
npm run retrieve -- <owner> <repo> "<question>"

# 4. Build extension into extension/dist
npm run build:extension

# 5. Run all tests
npm run test
```

---

### Next Task: Phase 6 (End-to-End Demo Integration & Side Panel UI Connection)

