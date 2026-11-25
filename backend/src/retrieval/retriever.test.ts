import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitTextIntoChunks, chunkRecord } from './chunker';
import { cosineSimilarity } from './similarity';
import { HistoryRetriever } from './retriever';
import { RepositoryDatabase } from '../db/database';
import { GitHubGraphQLClient } from '../github/client';
import { GeminiEmbedder } from './embedder';
import { NormalizedRecord } from '../types';

describe('Retrieval and Chunking Pipeline', () => {
  it('splits long text respecting word boundaries and overlap', () => {
    const text = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10';
    const chunks = splitTextIntoChunks(text, 25, 5);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(25);
    }
  });

  it('chunkRecord preserves original GitHub URL and metadata', () => {
    const record: NormalizedRecord = {
      id: 'pr-42',
      repoOwner: 'fastify',
      repoName: 'fastify',
      type: 'pull_request',
      githubId: '42',
      url: 'https://github.com/fastify/fastify/pull/42',
      title: 'Fix plugin registration',
      body: 'Plugin encapsulation fix details here',
      author: 'mcollina',
      createdAt: '2026-11-20T10:00:00Z',
    };

    const chunks = chunkRecord(record);
    expect(chunks.length).toBe(1);
    expect(chunks[0].sourceUrl).toBe('https://github.com/fastify/fastify/pull/42');
    expect(chunks[0].sourceType).toBe('pull_request');
    expect(chunks[0].sourceTitle).toBe('Fix plugin registration');
    expect(chunks[0].text).toContain('https://github.com/fastify/fastify/pull/42');
    expect(chunks[0].text).toContain('mcollina');
  });

  it('computes cosine similarity accurately', () => {
    // Identical vectors -> similarity = 1.0
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    // Orthogonal vectors -> similarity = 0.0
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    // Opposite vectors -> similarity = -1.0
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    // Empty vectors -> 0
    expect(cosineSimilarity([], [])).toBe(0);
  });

  describe('HistoryRetriever with mock dependencies', () => {
    let db: RepositoryDatabase;
    let mockClient: GitHubGraphQLClient;
    let mockEmbedder: GeminiEmbedder;
    let retriever: HistoryRetriever;

    beforeEach(() => {
      db = new RepositoryDatabase(':memory:');
      mockClient = {
        fetchRepositoryHistory: vi.fn().mockResolvedValue({
          records: [
            {
              id: 'owner/repo/pr-1',
              repoOwner: 'owner',
              repoName: 'repo',
              type: 'pull_request',
              githubId: '1',
              url: 'https://github.com/owner/repo/pull/1',
              title: 'Fix auth cookies',
              body: 'Authentication cookie security fix',
              author: 'alice',
              createdAt: '2026-11-20T10:00:00Z',
            },
            {
              id: 'owner/repo/issue-2',
              repoOwner: 'owner',
              repoName: 'repo',
              type: 'issue',
              githubId: '2',
              url: 'https://github.com/owner/repo/issues/2',
              title: 'Cookie parsing error',
              body: 'Cookies are dropped on cross-origin requests',
              author: 'bob',
              createdAt: '2026-11-19T10:00:00Z',
            },
          ],
          relationships: [
            {
              parentRecordId: 'owner/repo/pr-1',
              childRecordId: 'owner/repo/issue-2',
              relationshipType: 'pr_issue',
            },
          ],
          prCount: 1,
          isTruncated: false,
          fetchedAt: new Date().toISOString(),
        }),
      } as unknown as GitHubGraphQLClient;

      mockEmbedder = {
        embedText: vi.fn().mockImplementation(async (text: string) => {
          if (text.includes('auth') || text.includes('cookie')) {
            return [1.0, 0.0, 0.0];
          }
          return [0.0, 1.0, 0.0];
        }),
        embedChunks: vi.fn().mockImplementation(async (chunks: Array<{ id: string; text: string }>) => {
          return chunks.map((c) => ({
            chunkId: c.id,
            model: 'mock-model',
            vector: c.text.includes('auth') ? [1.0, 0.0, 0.0] : [0.8, 0.2, 0.0],
            dimensions: 3,
          }));
        }),
      } as unknown as GeminiEmbedder;

      retriever = new HistoryRetriever(db, mockClient, mockEmbedder);
    });

    it('ingests repository records, chunks, and embeddings into cache', async () => {
      const summary = await retriever.ingestRepository('owner', 'repo');

      expect(summary.cached).toBe(false);
      expect(summary.counts.pullRequests).toBe(1);
      expect(summary.counts.issues).toBe(1);
      expect(summary.counts.chunks).toBe(2);
      expect(summary.counts.embeddings).toBe(2);
      expect(mockClient.fetchRepositoryHistory).toHaveBeenCalledTimes(1);
      expect(mockEmbedder.embedChunks).toHaveBeenCalledTimes(1);

      // Subsequent ingest without forceRefresh reuses cache without calling GitHub or embedder again
      const cachedSummary = await retriever.ingestRepository('owner', 'repo');
      expect(cachedSummary.cached).toBe(true);
      expect(cachedSummary.counts.pullRequests).toBe(1);
      expect(mockClient.fetchRepositoryHistory).toHaveBeenCalledTimes(1); // not called again
      expect(mockEmbedder.embedChunks).toHaveBeenCalledTimes(1); // not called again
    });

    it('retrieves and ranks top-K evidence by cosine similarity', async () => {
      await retriever.ingestRepository('owner', 'repo');

      const result = await retriever.retrieveEvidence('owner', 'repo', 'Why was the auth cookie changed?');

      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].similarity).toBeGreaterThan(0.7);
      expect(result.evidence[0].url).toContain('https://github.com/owner/repo/');
      expect(result.evidence[0].title).toBeDefined();
    });

    it('honestly returns empty evidence when repository has no cached chunks', async () => {
      const result = await retriever.retrieveEvidence('nonexistent', 'repo', 'any question');
      expect(result.evidence).toEqual([]);
    });

    it('hits the same cache when requested with different letter case', async () => {
      // Ingest with mixed case
      await retriever.ingestRepository('Fastify', 'Fastify');
      expect(mockClient.fetchRepositoryHistory).toHaveBeenCalledTimes(1);

      // Subsequent ingest with lower case should hit the fresh cache without re-fetching
      const summaryLower = await retriever.ingestRepository('fastify', 'fastify');
      expect(summaryLower.cached).toBe(true);
      expect(mockClient.fetchRepositoryHistory).toHaveBeenCalledTimes(1);

      // Subsequent ingest with upper case should also hit the fresh cache
      const summaryUpper = await retriever.ingestRepository('FASTIFY', 'FASTIFY');
      expect(summaryUpper.cached).toBe(true);
      expect(mockClient.fetchRepositoryHistory).toHaveBeenCalledTimes(1);
    });

    it('keeps old data and does not mark repo fresh when embedding fails', async () => {
      // 1. Initial successful ingest
      const initialSummary = await retriever.ingestRepository('owner', 'repo');
      expect(initialSummary.cached).toBe(false);
      expect(db.isFresh('owner', 'repo', 60000)).toBe(true);
      expect(db.getRecordCount('owner', 'repo')).toBe(2);
      expect(db.getChunkCount('owner', 'repo')).toBe(2);
      expect(db.getEmbeddingCount('owner', 'repo')).toBe(2);

      const initialMeta = db.getRepository('owner', 'repo');
      const initialFetchedAt = initialMeta?.lastFetchedAt;

      // 2. Mock embedChunks to throw an error (e.g. rate limit / network error)
      mockEmbedder.embedChunks = vi.fn().mockRejectedValue(new Error('Gemini embedding failed'));

      // 3. Attempt forced refresh ingest, which should fail during embedding
      await expect(
        retriever.ingestRepository('owner', 'repo', { forceRefresh: true })
      ).rejects.toThrow('Gemini embedding failed');

      // 4. Verify that previous cache is completely intact!
      expect(db.getRecordCount('owner', 'repo')).toBe(2);
      expect(db.getChunkCount('owner', 'repo')).toBe(2);
      expect(db.getEmbeddingCount('owner', 'repo')).toBe(2);

      // And timestamp / metadata was NOT modified by the failed attempt
      const afterMeta = db.getRepository('owner', 'repo');
      expect(afterMeta?.lastFetchedAt).toBe(initialFetchedAt);
    });
  });
});
