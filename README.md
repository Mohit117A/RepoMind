# RepoMind

RepoMind is a page-aware Chrome extension and backend assistant for GitHub. When you view a repository and wonder why a specific code change or architectural decision was made, RepoMind surfaces the reasoning by connecting and analyzing pull requests, reviews, issues, and commit history. Answers are strictly grounded in verifiable GitHub history with direct clickable citations—if evidence is insufficient, it explicitly states so rather than hallucinating.

---

## Current Status (Session 2: GraphQL Ingest & SQLite Embedding Retrieval)

- **Backend:** Express + TypeScript server with health check (`GET /health`), request validation via Zod, and `/api/ask` returning HTTP 501 `not_implemented` (honest placeholder pending Phase 4 answer generation).
- **GitHub GraphQL Ingestion (Phase 2):** Bounded history fetching for public repositories covering pull requests, linked issues, PR reviews, discussion comments, and associated commits with typed error mapping and truncation tracking.
- **SQLite Cache & Embeddings (Phase 3):** Local cache using `better-sqlite3`, chunking with source metadata and verified URLs, vector embeddings via Google Gemini (`gemini-embedding-001`, 3072 dimensions), and cosine similarity retrieval with developer CLI verification tools (`npm run ingest`, `npm run retrieve`).
- **Extension:** Chrome Manifest V3 side panel with dynamic repository detection from active GitHub tabs, clean status feedback, and response display scaffolding.
- **Pending Implementation (Upcoming Sessions):**
  - Phase 4: Gemini LLM evidence-grounded answering.
  - Phase 6: End-to-end integration and demo readiness.

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
│       └── llm/            # Placeholder for Phase 4 Gemini answer generation
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
- `GEMINI_API_KEY`: Google Gemini API key from Google AI Studio. Required for Phase 3 vector embeddings.
  - *How to get:* Visit [Google AI Studio](https://aistudio.google.com/) -> Get API Key.
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

- **Phase 4 Pending:** `POST /api/ask` currently returns HTTP 501 `not_implemented` pending Phase 4 evidence-grounded Gemini answering.
- **Public Repositories Only:** Private repositories and external Git hosts (GitLab/Bitbucket) are explicitly out of scope for this MVP.
- **Bounded History:** The MVP indexes recent repository history (capped at 20 PRs and nested connections); it is not a full-repository semantic search engine.
