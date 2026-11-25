import fs from 'fs';
import path from 'path';
import DatabaseConstructor, { Database } from 'better-sqlite3';
import { config } from '../config';
import {
  NormalizedRecord,
  NormalizedRelationship,
  TextChunk,
  ChunkEmbedding,
  SourceType,
} from '../types';
import { CREATE_TABLES_SQL } from './schema';

export interface RepositoryMetadata {
  owner: string;
  repo: string;
  lastFetchedAt: string;
  isTruncated: boolean;
  prCount: number;
}

export class RepositoryDatabase {
  private db: Database;
  public readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || config.databasePath;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseConstructor(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  public initSchema(): void {
    this.db.exec(CREATE_TABLES_SQL);
  }

  public getRepository(owner: string, repo: string): RepositoryMetadata | null {
    const stmt = this.db.prepare(
      'SELECT owner, repo, last_fetched_at, is_truncated, pr_count FROM repositories WHERE LOWER(owner) = LOWER(?) AND LOWER(repo) = LOWER(?)'
    );
    const row = stmt.get(owner, repo) as
      | {
          owner: string;
          repo: string;
          last_fetched_at: string;
          is_truncated: number;
          pr_count: number;
        }
      | undefined;

    if (!row) return null;
    return {
      owner: row.owner,
      repo: row.repo,
      lastFetchedAt: row.last_fetched_at,
      isTruncated: Boolean(row.is_truncated),
      prCount: row.pr_count,
    };
  }

  public upsertRepository(
    owner: string,
    repo: string,
    isTruncated: boolean,
    prCount: number,
    fetchedAt = new Date().toISOString()
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO repositories (owner, repo, last_fetched_at, is_truncated, pr_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner, repo) DO UPDATE SET
        last_fetched_at = excluded.last_fetched_at,
        is_truncated = excluded.is_truncated,
        pr_count = excluded.pr_count
    `);
    stmt.run(owner, repo, fetchedAt, isTruncated ? 1 : 0, prCount);
  }

  public isFresh(owner: string, repo: string, ttlMs: number): boolean {
    const meta = this.getRepository(owner, repo);
    if (!meta) return false;
    const age = Date.now() - new Date(meta.lastFetchedAt).getTime();
    return age < ttlMs;
  }

  public upsertRecords(records: NormalizedRecord[]): void {
    if (records.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT INTO records (id, repo_owner, repo_name, type, github_id, url, title, body, author, created_at, updated_at)
      VALUES (@id, @repoOwner, @repoName, @type, @githubId, @url, @title, @body, @author, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        author = excluded.author,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((items: NormalizedRecord[]) => {
      for (const item of items) {
        stmt.run({
          id: item.id,
          repoOwner: item.repoOwner,
          repoName: item.repoName,
          type: item.type,
          githubId: item.githubId,
          url: item.url,
          title: item.title,
          body: item.body,
          author: item.author,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || null,
        });
      }
    });

    insertMany(records);
  }

  public upsertRelationships(relationships: NormalizedRelationship[]): void {
    if (relationships.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO record_relationships (parent_record_id, child_record_id, relationship_type)
      VALUES (?, ?, ?)
    `);

    const insertMany = this.db.transaction((rels: NormalizedRelationship[]) => {
      for (const rel of rels) {
        stmt.run(rel.parentRecordId, rel.childRecordId, rel.relationshipType);
      }
    });

    insertMany(relationships);
  }

  public getRecords(owner: string, repo: string): NormalizedRecord[] {
    const stmt = this.db.prepare(
      'SELECT id, repo_owner, repo_name, type, github_id, url, title, body, author, created_at, updated_at FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const rows = stmt.all(owner, repo) as Array<{
      id: string;
      repo_owner: string;
      repo_name: string;
      type: SourceType;
      github_id: string;
      url: string;
      title: string;
      body: string;
      author: string | null;
      created_at: string;
      updated_at: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      repoOwner: r.repo_owner,
      repoName: r.repo_name,
      type: r.type,
      githubId: r.github_id,
      url: r.url,
      title: r.title,
      body: r.body,
      author: r.author,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertChunks(chunks: TextChunk[]): void {
    if (chunks.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, record_id, repo_owner, repo_name, chunk_index, text, source_type, source_title, source_url, timestamp)
      VALUES (@id, @recordId, @repoOwner, @repoName, @chunkIndex, @text, @sourceType, @sourceTitle, @sourceUrl, @timestamp)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        source_title = excluded.source_title,
        source_url = excluded.source_url
    `);

    const insertMany = this.db.transaction((items: TextChunk[]) => {
      for (const item of items) {
        stmt.run({
          id: item.id,
          recordId: item.recordId,
          repoOwner: item.repoOwner,
          repoName: item.repoName,
          chunkIndex: item.chunkIndex,
          text: item.text,
          sourceType: item.sourceType,
          sourceTitle: item.sourceTitle,
          sourceUrl: item.sourceUrl,
          timestamp: item.timestamp,
        });
      }
    });

    insertMany(chunks);
  }

  public upsertEmbeddings(embeddings: ChunkEmbedding[]): void {
    if (embeddings.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT INTO embeddings (chunk_id, model_name, vector_json, dimensions)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chunk_id) DO UPDATE SET
        model_name = excluded.model_name,
        vector_json = excluded.vector_json,
        dimensions = excluded.dimensions
    `);

    const insertMany = this.db.transaction((items: ChunkEmbedding[]) => {
      for (const item of items) {
        stmt.run(
          item.chunkId,
          item.model,
          JSON.stringify(item.vector),
          item.dimensions
        );
      }
    });

    insertMany(embeddings);
  }

  public getChunksWithEmbeddings(
    owner: string,
    repo: string
  ): Array<{ chunk: TextChunk; embedding: ChunkEmbedding }> {
    const stmt = this.db.prepare(`
      SELECT 
        c.id, c.record_id, c.repo_owner, c.repo_name, c.chunk_index, c.text,
        c.source_type, c.source_title, c.source_url, c.timestamp,
        e.model_name, e.vector_json, e.dimensions
      FROM chunks c
      JOIN embeddings e ON c.id = e.chunk_id
      WHERE LOWER(c.repo_owner) = LOWER(?) AND LOWER(c.repo_name) = LOWER(?)
    `);

    const rows = stmt.all(owner, repo) as Array<{
      id: string;
      record_id: string;
      repo_owner: string;
      repo_name: string;
      chunk_index: number;
      text: string;
      source_type: SourceType;
      source_title: string;
      source_url: string;
      timestamp: string;
      model_name: string;
      vector_json: string;
      dimensions: number;
    }>;

    return rows.map((r) => ({
      chunk: {
        id: r.id,
        recordId: r.record_id,
        repoOwner: r.repo_owner,
        repoName: r.repo_name,
        chunkIndex: r.chunk_index,
        text: r.text,
        sourceType: r.source_type,
        sourceTitle: r.source_title,
        sourceUrl: r.source_url,
        timestamp: r.timestamp,
      },
      embedding: {
        chunkId: r.id,
        model: r.model_name,
        vector: JSON.parse(r.vector_json) as number[],
        dimensions: r.dimensions,
      },
    }));
  }

  public getRecordCount(owner: string, repo: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const result = stmt.get(owner, repo) as { count: number };
    return result.count;
  }

  public getChunkCount(owner: string, repo: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM chunks WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const result = stmt.get(owner, repo) as { count: number };
    return result.count;
  }

  public getEmbeddingCount(owner: string, repo: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM embeddings e
      JOIN chunks c ON e.chunk_id = c.id
      WHERE LOWER(c.repo_owner) = LOWER(?) AND LOWER(c.repo_name) = LOWER(?)
    `);
    const result = stmt.get(owner, repo) as { count: number };
    return result.count;
  }

  public getRelationships(owner: string, repo: string): NormalizedRelationship[] {
    const prefix = `${owner.toLowerCase()}/${repo.toLowerCase()}/%`;
    const stmt = this.db.prepare(`
      SELECT parent_record_id, child_record_id, relationship_type
      FROM record_relationships
      WHERE parent_record_id LIKE ? 
         OR child_record_id LIKE ?
         OR parent_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
         OR child_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
    `);
    const rows = stmt.all(prefix, prefix, owner, repo, owner, repo) as Array<{
      parent_record_id: string;
      child_record_id: string;
      relationship_type: NormalizedRelationship['relationshipType'];
    }>;

    return rows.map((r) => ({
      parentRecordId: r.parent_record_id,
      childRecordId: r.child_record_id,
      relationshipType: r.relationship_type,
    }));
  }

  public clearRepoData(owner: string, repo: string): void {
    const prefix = `${owner.toLowerCase()}/${repo.toLowerCase()}/%`;

    const deleteRelationships = this.db.prepare(`
      DELETE FROM record_relationships 
      WHERE parent_record_id LIKE ? 
         OR child_record_id LIKE ?
         OR parent_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
         OR child_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
    `);
    const deleteChunks = this.db.prepare(
      'DELETE FROM chunks WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const deleteRecords = this.db.prepare(
      'DELETE FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const deleteRepo = this.db.prepare(
      'DELETE FROM repositories WHERE LOWER(owner) = LOWER(?) AND LOWER(repo) = LOWER(?)'
    );

    const runCleanup = this.db.transaction(() => {
      deleteRelationships.run(prefix, prefix, owner, repo, owner, repo);
      deleteChunks.run(owner, repo);
      deleteRecords.run(owner, repo);
      deleteRepo.run(owner, repo);
    });

    runCleanup();
  }

  /**
   * Replaces all records, relationships, chunks, and embeddings for a repository,
   * marking it fresh LAST, all inside a single atomic SQLite transaction.
   * If any step fails before or during this transaction, previous cache remains intact.
   */
  public saveRepositoryData(
    owner: string,
    repo: string,
    history: {
      records: NormalizedRecord[];
      relationships: NormalizedRelationship[];
      isTruncated: boolean;
      prCount: number;
      fetchedAt: string;
    },
    chunks: TextChunk[],
    embeddings: ChunkEmbedding[]
  ): void {
    const prefix = `${owner.toLowerCase()}/${repo.toLowerCase()}/%`;

    const deleteRelationships = this.db.prepare(`
      DELETE FROM record_relationships 
      WHERE parent_record_id LIKE ? 
         OR child_record_id LIKE ?
         OR parent_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
         OR child_record_id IN (SELECT id FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?))
    `);
    const deleteChunks = this.db.prepare(
      'DELETE FROM chunks WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );
    const deleteRecords = this.db.prepare(
      'DELETE FROM records WHERE LOWER(repo_owner) = LOWER(?) AND LOWER(repo_name) = LOWER(?)'
    );

    const insertRecord = this.db.prepare(`
      INSERT INTO records (id, repo_owner, repo_name, type, github_id, url, title, body, author, created_at, updated_at)
      VALUES (@id, @repoOwner, @repoName, @type, @githubId, @url, @title, @body, @author, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        author = excluded.author,
        updated_at = excluded.updated_at
    `);

    const insertRelationship = this.db.prepare(`
      INSERT OR IGNORE INTO record_relationships (parent_record_id, child_record_id, relationship_type)
      VALUES (?, ?, ?)
    `);

    const insertChunk = this.db.prepare(`
      INSERT INTO chunks (id, record_id, repo_owner, repo_name, chunk_index, text, source_type, source_title, source_url, timestamp)
      VALUES (@id, @recordId, @repoOwner, @repoName, @chunkIndex, @text, @sourceType, @sourceTitle, @sourceUrl, @timestamp)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        source_title = excluded.source_title,
        source_url = excluded.source_url
    `);

    const insertEmbedding = this.db.prepare(`
      INSERT INTO embeddings (chunk_id, model_name, vector_json, dimensions)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chunk_id) DO UPDATE SET
        model_name = excluded.model_name,
        vector_json = excluded.vector_json,
        dimensions = excluded.dimensions
    `);

    const upsertRepo = this.db.prepare(`
      INSERT INTO repositories (owner, repo, last_fetched_at, is_truncated, pr_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner, repo) DO UPDATE SET
        last_fetched_at = excluded.last_fetched_at,
        is_truncated = excluded.is_truncated,
        pr_count = excluded.pr_count
    `);

    const saveTransaction = this.db.transaction(() => {
      // 1. Delete previous data for this repository
      deleteRelationships.run(prefix, prefix, owner, repo, owner, repo);
      deleteChunks.run(owner, repo);
      deleteRecords.run(owner, repo);

      // 2. Insert records
      for (const item of history.records) {
        insertRecord.run({
          id: item.id,
          repoOwner: item.repoOwner,
          repoName: item.repoName,
          type: item.type,
          githubId: item.githubId,
          url: item.url,
          title: item.title,
          body: item.body,
          author: item.author,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || null,
        });
      }

      // 3. Insert relationships
      for (const rel of history.relationships) {
        insertRelationship.run(rel.parentRecordId, rel.childRecordId, rel.relationshipType);
      }

      // 4. Insert chunks
      for (const chk of chunks) {
        insertChunk.run({
          id: chk.id,
          recordId: chk.recordId,
          repoOwner: chk.repoOwner,
          repoName: chk.repoName,
          chunkIndex: chk.chunkIndex,
          text: chk.text,
          sourceType: chk.sourceType,
          sourceTitle: chk.sourceTitle,
          sourceUrl: chk.sourceUrl,
          timestamp: chk.timestamp,
        });
      }

      // 5. Insert embeddings
      for (const emb of embeddings) {
        insertEmbedding.run(
          emb.chunkId,
          emb.model,
          JSON.stringify(emb.vector),
          emb.dimensions
        );
      }

      // 6. Mark fresh LAST
      upsertRepo.run(
        owner,
        repo,
        history.fetchedAt,
        history.isTruncated ? 1 : 0,
        history.prCount
      );
    });

    saveTransaction();
  }

  public close(): void {
    this.db.close();
  }
}

// Default shared instance
export const database = new RepositoryDatabase();
