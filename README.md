# RepoMind

RepoMind is a page-aware Chrome extension and backend assistant for GitHub. When you view a repository and wonder why a specific code change or architectural decision was made, RepoMind surfaces the reasoning by connecting and analyzing pull requests, reviews, issues, and commit history. Answers are strictly grounded in verifiable GitHub history with direct clickable citations—if evidence is insufficient, it explicitly states so rather than hallucinating.

---

## Current Status (Session 1: Initial Skeleton)

- **Backend:** Express + TypeScript skeleton with health check (`GET /health`), request validation via Zod, and `/api/ask` returning HTTP 501 `not_implemented`.
- **Extension:** Chrome Manifest V3 side panel with dynamic repository detection from active GitHub tabs, clean status feedback, and response display scaffolding.
- **Pending Implementation (Upcoming Sessions):**
  - Phase 2: GitHub GraphQL API integration.
  - Phase 3: SQLite cache and embeddings/retrieval pipeline.
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
- [Phase 2] Fetches PRs, issues, reviews, and commits via GitHub GraphQL
- [Phase 3] Caches records and embeddings in SQLite
- [Phase 4] Calls Gemini API with strict evidence-only prompt
        │
        ▼
Side Panel UI (React + Tailwind CSS)
```

---

## Requirements

- **Node.js:** Current LTS (v20 or newer; recommended v22 or v24). Verified on `v24.13.0`.
- **npm:** `v10` or newer. Verified on `v11.6.2`.
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
│       ├── config.ts       # Environment variable loader & validator
│       ├── types.ts        # Shared TypeScript interfaces
│       ├── routes/         # Route handlers (/health, /api/ask)
│       ├── lib/            # Zod validation & error handling
│       └── github/, db/, retrieval/, llm/  # Placeholders for future phases
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

```powershell
cd backend
npm install
cd ../extension
npm install
cd ..
```

### 2. Configure Environment Variables

Create a local `.env` file at the repository root by copying `.env.example`:

```powershell
cp .env.example .env
```

The `.env` file contains:
- `PORT`: Backend port (defaults to `3001` if unset).
- `GITHUB_TOKEN`: GitHub Personal Access Token (PAT) with read access to public repositories *(Not required in Session 1; will be used in Phase 2)*.
- `GEMINI_API_KEY`: Google Gemini API key from Google AI Studio *(Not required in Session 1; will be used in Phase 4)*.
- `DATABASE_PATH`: File path for local SQLite cache *(Not required in Session 1; will be used in Phase 3)*.

> **IMPORTANT:** Never commit `.env` or any secret keys to Git. `.gitignore` is already configured to exclude `.env` files and SQLite databases.

---

## Running the Project

### Start Backend

From the repository root, start the backend in watch mode:

```powershell
npm run dev:backend
```

The backend starts at `http://localhost:3001`. A successful startup logs:
```text
[RepoMind Backend] Server running at http://localhost:3001
```

### Build the Chrome Extension

To build the extension into `extension/dist`:

```powershell
npm run build:extension
```

To watch extension files and rebuild automatically during development:

```powershell
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
7. Open any public GitHub repository (e.g. `https://github.com/facebook/react`).
8. Click the RepoMind toolbar icon to open the side panel.

> **Note:** Whenever extension code is rebuilt, go to `chrome://extensions` and click the reload icon on the RepoMind card, then reopen the side panel.

---

## Running Tests

Run unit tests for both the backend and extension:

```powershell
npm run test
```

Or test each package independently:

```powershell
# Backend tests (Vitest + Supertest)
cd backend && npm run test

# Extension tests (Vitest)
cd extension && npm run test
```
