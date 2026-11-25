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
