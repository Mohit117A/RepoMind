# RepoMind

RepoMind is a page-aware Chrome extension and backend assistant for GitHub. When you view a repository and wonder why a specific code change or architectural decision was made, RepoMind surfaces the reasoning by connecting and analyzing pull requests, reviews, issues, and commit history. Answers are strictly grounded in verifiable GitHub history with direct clickable citations—if evidence is insufficient, it explicitly states so rather than hallucinating.

---

## Current Status (MVP Complete & Verified)

- **Backend:** Express + TypeScript server with health check (`GET /health`), request validation via Zod, and `/api/ask` delivering evidence-grounded AI answers with structured citations.
- **GitHub GraphQL Ingestion (Phase 2):** Bounded history fetching for public repositories covering pull requests, linked issues, PR reviews, discussion comments, and associated commits with typed error mapping and truncation tracking.
- **SQLite Cache & Embeddings (Phase 3):** Local cache using `better-sqlite3`, chunking with source metadata and verified URLs, vector embeddings via Google Gemini (`gemini-embedding-001`, 3072 dimensions), and cosine similarity retrieval with developer CLI verification tools (`npm run ingest`, `npm run retrieve`).
- **Grounded Answer Generation (Phase 4):** Strictly evidence-based reasoning powered by `gemini-3.5-flash-lite` (configurable via `GEMINI_MODEL`, default: `gemini-3.5-flash-lite`). Includes prompt isolation against prompt injection, structured JSON output validation, URL rejection in answers, auto-inclusion of all named PR/issue numbers in citations, clear handling of unmerged proposals, and automatic fallback to an honest insufficient-evidence response whenever history does not support the claim.
- **Extension (Phase 5):** Chrome Manifest V3 side panel with dynamic repository detection from active GitHub tabs, clean status feedback, responsive UI with informative loading indicator, and verified clickable GitHub source links.
- **Full Verification:** Tested live in Google Chrome and verified end-to-end against `fastify/fastify`.

---

## Architecture Overview

```text
GitHub repository page (active tab)
        │
        ▼
Chrome MV3 Extension (Side Panel)
- Reads active tab URL and detects {owner}/{repo}
- Question input & validation
- Displays grounded answer and clickable sources
        │
        │ POST /api/ask
        ▼
Node.js + TypeScript Backend (Port 3001)
- Validates request payload ({ owner, repo, question })
- [Phase 2] Fetches PRs, issues, reviews, comments, and commits via GitHub GraphQL
- [Phase 3] Caches records and Gemini vector embeddings in SQLite
- [Phase 4] Calls Gemini API with strict evidence-only prompt
        │
        ▼
Side Panel UI (React + Tailwind CSS)
```

---

## Requirements

- **Node.js:** Current LTS (v20 or newer; recommended v22 or v24). Verified on `v24.22.0`.
- **npm:** `v10` or newer.
- **Google Chrome:** Version 114+ (supports the Chrome Side Panel API).

---

## Project Structure

```text
RepoMind/
├── README.md               # Project documentation and quickstart
├── implementation.md       # Team source of truth and product specification
├── HANDOFF.md              # Session-by-session developer handoff log
├── .gitignore              # Git ignore rules (protects secrets, build output, db)
├── .env.example            # Environment variable template
├── package.json            # Root convenience scripts
├── backend/                # Node.js + Express backend service
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts       # Server entry point
│       ├── app.ts          # Express application setup & CORS
│       ├── config.ts       # Centralized config, fetch limits, cache TTL, and constants
│       ├── types.ts        # Shared TypeScript interfaces
│       ├── routes/         # Route handlers (/health, /api/ask)
│       ├── lib/            # Zod validation & error handling
│       ├── github/         # GraphQL query, client, normalization (Phase 2)
│       ├── db/             # SQLite schema, connection, upsert queries (Phase 3)
│       ├── retrieval/      # Chunking, Gemini embedder, cosine ranking (Phase 3)
│       ├── cli/            # Developer tools (ingest.ts, retrieve.ts)
│       └── llm/            # Phase 4 Gemini grounded answer generator & tests
└── extension/              # Chrome Extension MV3
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts      # Multi-entry Vite bundler
    ├── tailwind.config.js  # Tailwind theme (Navy, Orange, Rust, Soft)
    ├── public/
    │   ├── manifest.json   # Chrome MV3 manifest
    │   └── icons/          # Extension icons (16px, 48px, 128px)
    └── src/
        ├── background.ts   # Service worker configuring side panel click behavior
        ├── types.ts        # Shared types matching backend
        ├── lib/            # GitHub URL parser
        └── sidepanel/      # React side panel app, components, and hooks
```

---

## Setup Instructions

### 1. Install Dependencies

Install dependencies for both packages from the project root:

```bash
cd backend
npm install
cd ../extension
npm install
cd ..
```

### 2. Configure Environment Variables

Create a local `.env` file at the repository root by copying `.env.example`:

```bash
cp .env.example .env
```

The `.env` file contains:
- `PORT`: Backend port (defaults to `3001` if unset).
- `GITHUB_TOKEN`: GitHub Personal Access Token (classic with `public_repo` read access or fine-grained token with Public Repositories read access). Required for Phase 2 history ingestion.
  - *How to get:* Visit [GitHub Personal Access Tokens Settings](https://github.com/settings/tokens) -> Generate new token (classic) -> Select `public_repo` (read only).
- `GEMINI_API_KEY`: Google Gemini API key from Google AI Studio. Required for vector embeddings and Phase 4 answering.
  - *How to get:* Visit [Google AI Studio](https://aistudio.google.com/) -> Get API Key.
- `GEMINI_MODEL`: Model used for evidence-grounded answer generation (defaults to `gemini-3.5-flash-lite`, configurable).
- `DATABASE_PATH`: File path for local SQLite cache (defaults to `backend/data/repomind.db`, which is gitignored).

> **IMPORTANT:** Never commit `.env` or any secret keys to Git. `.gitignore` is strictly configured to exclude `.env` files and SQLite databases (`*.db`, `*.sqlite`, `backend/data/`).

---

## Developer Verification Tools (Phase 2 & Phase 3)

Two developer CLI commands allow verifying GraphQL fetching, SQLite caching, and embedding retrieval against any public repository:

### 1. Ingest Repository History

Fetches recent PRs, reviews, linked issues, comments, and commits via GraphQL, chunks records, generates embeddings via Gemini, and stores them in SQLite:

```bash
# Ingest with 24-hour cache TTL
npm run ingest -- <owner> <repo>

# Force refresh (clears cached repository data and refetches fresh)
npm run ingest -- <owner> <repo> --refresh
```

*Example:*
```bash
npm run ingest -- fastify fastify
```

### 2. Retrieve Evidence for a Question

Embeds a natural language question using Gemini, performs cosine similarity search over cached chunks, and prints the top-5 evidence items with source titles, URLs, timestamps, and similarity scores:

```bash
npm run retrieve -- <owner> <repo> "<question>"
```

*Example:*
```bash
npm run retrieve -- fastify fastify "Why was schema validation or null content handling changed?"
```

---

## MVP Limits & Caching Rules

Configured in `backend/src/config.ts`:
- **Cache TTL:** 24 hours (`CACHE_TTL_MS = 86,400,000`). Within TTL, `ingest` reuses the local SQLite cache without hitting GitHub or Gemini.
- **Pull Requests:** Bounded to the 20 most recent pull requests (`MAX_PRS = 20`).
- **PR Reviews:** Up to 5 reviews per PR (`MAX_REVIEWS_PER_PR = 5`).
- **PR Discussion Comments:** Up to 5 top-level comments per PR (`MAX_COMMENTS_PER_PR = 5`).
- **Review Comments:** Up to 5 inline comments per review (`MAX_REVIEW_COMMENTS_PER_REVIEW = 5`).
- **Closing Issues:** Up to 5 linked issues per PR (`MAX_CLOSING_ISSUES_PER_PR = 5`).
- **Issue Comments:** Up to 5 comments per linked issue (`MAX_ISSUE_COMMENTS_PER_ISSUE = 5`).
- **Associated Commits:** Up to 5 commits per PR (`MAX_COMMITS_PER_PR = 5`).
- **Chunk Size:** Max 800 characters per chunk with 100 character overlap, preserving word boundaries.
- **Embedding Model:** `models/gemini-embedding-001` (3072 dimensions).
- **Top-K Retrieval:** Top 5 evidence items by cosine similarity.

---

## Running the Project

### Start Backend

From the repository root, start the backend in watch mode:

```bash
npm run dev:backend
```

The backend starts at `http://localhost:3001`. A successful startup logs:
```text
[RepoMind Backend] Server running at http://localhost:3001
```

### Build the Chrome Extension

To build the extension into `extension/dist`:

```bash
npm run build:extension
```

To watch extension files and rebuild automatically during development:

```bash
npm run dev:extension
```

---

## Loading the Extension in Google Chrome

1. Open Google Chrome.
2. In the address bar, navigate to `chrome://extensions`.
3. In the top-right corner, switch **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top-left corner.
5. In the file picker, select the `RepoMind/extension/dist` folder.
6. Click the puzzle-piece icon in Chrome's toolbar and **Pin** RepoMind for quick access.
7. Open any public GitHub repository (e.g. `https://github.com/fastify/fastify`).
8. Click the RepoMind toolbar icon to open the side panel.

---

## Running Tests

Run unit tests for both the backend and extension:

```bash
npm run test
```

Or test each package independently:

```bash
# Backend tests (Vitest)
cd backend && npm run test

# Extension tests (Vitest)
cd extension && npm run test
```

---

## Known Limitations

- **Bounded History (20 Newest PRs):** The MVP indexes recent repository history, capped at the 20 most recent pull requests and their associated connections (reviews, comments, closing issues, commits). It is designed to explain recent decisions, not serve as a full-history code semantic search engine.
- **24-Hour Cache TTL:** Ingested repository records and embeddings are cached locally in SQLite for 24 hours (`CACHE_TTL_MS = 86,400,000`). Within this window, subsequent queries reuse the cache without contacting GitHub or Gemini. A cache refresh can be forced with `npm run ingest -- <owner> <repo> --refresh`.
- **Local Backend Execution:** The backend runs locally on `http://localhost:3001` and is not deployed to cloud hosting (e.g. Render/Railway) for this MVP.
- **Initial Load Latency:** The first question on a newly queried repository performs cold-start GraphQL fetching, chunking, and embedding generation (~130 chunks), which takes between 60 to 90 seconds. Subsequent questions on the same repository resolve in 2 to 4 seconds from cache.
- **Public Repositories Only:** Private repositories and external Git hosts (GitLab/Bitbucket) are explicitly out of scope for this MVP.

---

## Acceptance Criteria (from implementation.md)

All 13 acceptance criteria defined in `implementation.md` have been implemented and verified:

| Acceptance Criterion | Status | How and By Whom Tested |
|---|---|---|
| A Chrome MV3 extension loads unpacked without manifest errors. | Tested | Loaded unpacked in Google Chrome without errors by user and developer; verified via automated build checks (`npm run build:extension`). |
| It recognises a supported GitHub repository URL. | Tested | Tested across 13 test cases in `parseGithubUrl.test.ts` (Vitest) by developer; verified live on GitHub tabs in Chrome by user. |
| Its side panel opens and displays the repository identity. | Tested | Verified in Google Chrome by user using the Chrome Side Panel API (`chrome.sidePanel.setPanelBehavior`) and `RepoChip` component. |
| A user can submit a natural-language question. | Tested | Verified via `QuestionForm.tsx` unit and integration tests (Vitest) by developer; tested interactively in Chrome side panel by user. |
| The backend fetches real GitHub history using GraphQL. | Tested | Tested via `GitHubGraphQLClient` unit tests (Vitest) and live ingestion of `fastify/fastify` repository history by developer. |
| The backend caches fetched records in SQLite. | Tested | Tested via 7 integration tests in `database.test.ts` (Vitest) by developer; verified idempotency and cache persistence in `backend/data/repomind.db`. |
| Relevant evidence is retrieved for a question. | Tested | Tested via cosine similarity math and retriever ranking tests in `retriever.test.ts` (Vitest) and live CLI verification `npm run retrieve` by developer. |
| Gemini answers using only the retrieved evidence. | Tested | Tested via 12 unit tests in `generator.test.ts` (Vitest) by developer; verified live through `/api/ask` on `fastify/fastify` by developer and user. |
| The answer includes working links to real GitHub sources. | Tested | Tested via `AnswerCard.test.ts` (Vitest) by developer; verified live in Chrome side panel and direct API tests by user and developer. |
| The system explicitly reports insufficient evidence instead of guessing. | Tested | Tested via unit tests in `generator.test.ts` (Vitest) by developer; verified live on counterfactual question ("React to Vue") by developer and user. |
| Errors and loading states are visible and understandable. | Tested | Tested via `StatusBanner.tsx` component tests and live timeout/offline tests by developer; verified in Chrome by user. |
| The project has setup instructions and an `.env.example`. | Tested | Verified `.env.example` template, setup documentation, and secret leak prevention checks by developer. |
| A complete end-to-end demo has been tested on a public repository. | Tested | Tested live end-to-end against `fastify/fastify` via Chrome side panel by user and `/api/ask` API calls by developer. |

