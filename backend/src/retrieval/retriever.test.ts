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
              id: 'pr-1',
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
              id: 'issue-2',
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
              parentRecordId: 'pr-1',
              childRecordId: 'issue-2',
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
  });
});
