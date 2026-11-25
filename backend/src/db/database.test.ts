import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RepositoryDatabase } from './database';
import { NormalizedRecord, TextChunk, ChunkEmbedding } from '../types';

describe('RepositoryDatabase', () => {
  let db: RepositoryDatabase;

  beforeEach(() => {
    db = new RepositoryDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('manages repository metadata and freshness TTL', () => {
    expect(db.getRepository('owner', 'repo')).toBeNull();
    expect(db.isFresh('owner', 'repo', 60000)).toBe(false);

    db.upsertRepository('owner', 'repo', false, 5, new Date().toISOString());

    const meta = db.getRepository('owner', 'repo');
    expect(meta).not.toBeNull();
    expect(meta?.owner).toBe('owner');
    expect(meta?.prCount).toBe(5);
    expect(meta?.isTruncated).toBe(false);
    expect(db.isFresh('owner', 'repo', 60000)).toBe(true);

    // Expired TTL
    const oldTime = new Date(Date.now() - 100000).toISOString();
    db.upsertRepository('owner', 'repo', false, 5, oldTime);
    expect(db.isFresh('owner', 'repo', 60000)).toBe(false);
  });

  it('upserts records idempotently without creating duplicate rows', () => {
    const record: NormalizedRecord = {
      id: 'pr-1',
      repoOwner: 'owner',
      repoName: 'repo',
      type: 'pull_request',
      githubId: '1',
      url: 'https://github.com/owner/repo/pull/1',
      title: 'Initial Title',
      body: 'Initial Body',
      author: 'alice',
      createdAt: '2026-11-20T10:00:00Z',
    };

    db.upsertRecords([record]);
    expect(db.getRecordCount('owner', 'repo')).toBe(1);

    // Upsert again with updated title
    const updatedRecord: NormalizedRecord = {
      ...record,
      title: 'Updated Title',
    };

    db.upsertRecords([updatedRecord]);
    expect(db.getRecordCount('owner', 'repo')).toBe(1);

    const stored = db.getRecords('owner', 'repo');
    expect(stored[0].title).toBe('Updated Title');
  });

  it('stores and queries chunks with embeddings', () => {
    const record: NormalizedRecord = {
      id: 'pr-1',
      repoOwner: 'owner',
      repoName: 'repo',
      type: 'pull_request',
      githubId: '1',
      url: 'https://github.com/owner/repo/pull/1',
      title: 'PR 1',
      body: 'Some content',
      author: 'alice',
      createdAt: '2026-11-20T10:00:00Z',
    };
    db.upsertRecords([record]);

    const chunk: TextChunk = {
      id: 'chunk-pr-1-0',
      recordId: 'pr-1',
      repoOwner: 'owner',
      repoName: 'repo',
      chunkIndex: 0,
      text: 'Sample chunk text',
      sourceType: 'pull_request',
      sourceTitle: 'PR 1',
      sourceUrl: 'https://github.com/owner/repo/pull/1',
      timestamp: '2026-11-20T10:00:00Z',
    };
    db.upsertChunks([chunk]);

    const embedding: ChunkEmbedding = {
      chunkId: chunk.id,
      model: 'gemini-embedding-001',
      vector: [0.1, 0.2, 0.3],
      dimensions: 3,
    };
    db.upsertEmbeddings([embedding]);

    const results = db.getChunksWithEmbeddings('owner', 'repo');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe(chunk.id);
    expect(results[0].embedding.vector).toEqual([0.1, 0.2, 0.3]);
    expect(results[0].embedding.dimensions).toBe(3);
  });

  it('clears repository data cleanly', () => {
    db.upsertRepository('owner', 'repo', false, 1);
    db.upsertRecords([
      {
        id: 'pr-1',
        repoOwner: 'owner',
        repoName: 'repo',
        type: 'pull_request',
        githubId: '1',
        url: 'https://github.com/owner/repo/pull/1',
        title: 'PR 1',
        body: 'Body',
        author: 'alice',
        createdAt: '2026-11-20T10:00:00Z',
      },
    ]);

    expect(db.getRecordCount('owner', 'repo')).toBe(1);
    db.clearRepoData('owner', 'repo');
    expect(db.getRecordCount('owner', 'repo')).toBe(0);
    expect(db.getRepository('owner', 'repo')).toBeNull();
  });
});
