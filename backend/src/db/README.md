# SQLite Cache & Database Layer (Phase 3)

This module implements the local SQLite caching layer for repository history, chunks, and embeddings.

## Schema Overview

- `repositories`: Tracks repository identity (`owner`, `repo`), `last_fetched_at` timestamp, `is_truncated` boolean, and `pr_count`.
- `records`: Stores fetched GitHub items (PRs, issues, commits, reviews, comments) with unique IDs (`pr-123`, `issue-456`, `commit-abc1234`), metadata, and timestamps.
- `record_relationships`: Graph relationships linking PRs to linked issues, reviews, comments, and commits (`pr_issue`, `pr_commit`, `pr_review`, `pr_comment`, `issue_comment`, `review_comment`).
- `chunks`: Segmented text chunks derived from records, retaining complete source metadata (type, title, verified URL, timestamp).
- `embeddings`: Stores vector embeddings produced by Gemini (`gemini-embedding-001`, 3072 dimensions) indexed by `chunk_id`.

## Engine Choice: `better-sqlite3`

- Uses `better-sqlite3`, providing fast synchronous execution with prebuilt binaries across Linux, macOS, and Windows.
- Parameterized queries with prepared statements to prevent injection.
- WAL mode (`PRAGMA journal_mode = WAL`) and foreign key constraints enabled.
- Safe idempotent initialization (`CREATE TABLE IF NOT EXISTS`).
- Default path: `backend/data/repomind.db` (gitignored). Configurable via `DATABASE_PATH`.
