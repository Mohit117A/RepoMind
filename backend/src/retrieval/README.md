# History Retrieval Pipeline (Phase 3)

This module converts normalized GitHub records into searchable text chunks, creates semantic embeddings with Gemini, and performs cosine similarity retrieval over local SQLite cache.

## Pipeline Architecture

1. **Chunking (`chunker.ts`):**
   - Splits long records into overlapping text chunks (`CHUNK_MAX_CHARS`: 800, `CHUNK_OVERLAP_CHARS`: 100).
   - Preserves word boundaries rather than slicing mid-word.
   - Prepends source metadata headers containing `[TYPE]`, `Title`, `URL`, `Author`, and `Date`.
   - Every citation URL originates directly from a verified GitHub record.

2. **Embedding (`embedder.ts`):**
   - Calls Google Gemini API REST endpoint (`/v1beta/models/gemini-embedding-001:embedContent`).
   - Produces 3072-dimensional vector embeddings.
   - Keeps API keys strictly on the backend.
   - Throws clear actionable errors on missing/invalid keys or rate limits.

3. **Ranking & Retrieval (`similarity.ts`, `retriever.ts`):**
   - Computes cosine similarity between question embedding and stored chunk vectors.
   - Ranks chunks descending by score and returns top-K (`TOP_K`: 5) evidence items.
   - Returns empty evidence list honestly when cache is empty or no evidence is present.
