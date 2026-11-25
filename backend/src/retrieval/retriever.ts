import { RETRIEVAL_CONFIG } from '../config';
import { database, RepositoryDatabase } from '../db/database';
import { githubClient, GitHubGraphQLClient } from '../github/client';
import {
  EvidenceItem,
  IngestSummary,
  RetrievalResult,
  SourceType,
} from '../types';
import { chunkRecords } from './chunker';
import { geminiEmbedder, GeminiEmbedder } from './embedder';
import { cosineSimilarity } from './similarity';

export interface IngestOptions {
  forceRefresh?: boolean;
  onProgress?: (stage: string, progress?: { current: number; total: number }) => void;
}

export interface RetrieveOptions {
  topK?: number;
}

export class HistoryRetriever {
  private db: RepositoryDatabase;
  private client: GitHubGraphQLClient;
  private embedder: GeminiEmbedder;

  constructor(
    db = database,
    client = githubClient,
    embedder = geminiEmbedder
  ) {
    this.db = db;
    this.client = client;
    this.embedder = embedder;
  }

  /**
   * Ingests a repository: fetches from GitHub GraphQL if stale or missing,
   * stores records in SQLite, chunks them, and generates embeddings.
   */
  async ingestRepository(
    owner: string,
    repo: string,
    options: IngestOptions = {}
  ): Promise<IngestSummary> {
    const isFresh = this.db.isFresh(owner, repo, RETRIEVAL_CONFIG.CACHE_TTL_MS);

    if (isFresh && !options.forceRefresh) {
      const meta = this.db.getRepository(owner, repo)!;
      const records = this.db.getRecords(owner, repo);
      const chunksCount = this.db.getChunkCount(owner, repo);
      const embeddingsCount = this.db.getEmbeddingCount(owner, repo);

      return {
        owner,
        repo,
        cached: true,
        isTruncated: meta.isTruncated,
        counts: {
          pullRequests: records.filter((r) => r.type === 'pull_request').length,
          issues: records.filter((r) => r.type === 'issue').length,
          reviews: records.filter((r) => r.type === 'review').length,
          comments: records.filter((r) => r.type === 'comment').length,
          commits: records.filter((r) => r.type === 'commit').length,
          totalRecords: records.length,
          relationships: 0,
          chunks: chunksCount,
          embeddings: embeddingsCount,
        },
        fetchedAt: meta.lastFetchedAt,
      };
    }

    if (options.forceRefresh) {
      options.onProgress?.('Clearing stale cache...');
      this.db.clearRepoData(owner, repo);
    }

    options.onProgress?.('Fetching history from GitHub GraphQL...');
    const history = await this.client.fetchRepositoryHistory(owner, repo);

    options.onProgress?.('Saving records to SQLite...');
    this.db.upsertRepository(
      owner,
      repo,
      history.isTruncated,
      history.prCount,
      history.fetchedAt
    );
    this.db.upsertRecords(history.records);
    this.db.upsertRelationships(history.relationships);

    options.onProgress?.('Chunking records...');
    const chunks = chunkRecords(history.records);
    this.db.upsertChunks(chunks);

    options.onProgress?.(`Generating embeddings (${chunks.length} chunks)...`);
    const embeddings = await this.embedder.embedChunks(
      chunks,
      (current, total) => {
        options.onProgress?.('Embedding chunks', { current, total });
      }
    );

    options.onProgress?.('Saving embeddings to SQLite...');
    this.db.upsertEmbeddings(embeddings);

    return {
      owner,
      repo,
      cached: false,
      isTruncated: history.isTruncated,
      counts: {
        pullRequests: history.records.filter((r) => r.type === 'pull_request').length,
        issues: history.records.filter((r) => r.type === 'issue').length,
        reviews: history.records.filter((r) => r.type === 'review').length,
        comments: history.records.filter((r) => r.type === 'comment').length,
        commits: history.records.filter((r) => r.type === 'commit').length,
        totalRecords: history.records.length,
        relationships: history.relationships.length,
        chunks: chunks.length,
        embeddings: embeddings.length,
      },
      fetchedAt: history.fetchedAt,
    };
  }

  /**
   * Retrieves top-K relevant evidence items for a given question using cosine similarity over embeddings.
   */
  async retrieveEvidence(
    owner: string,
    repo: string,
    question: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievalResult> {
    const topK = options.topK || RETRIEVAL_CONFIG.TOP_K;

    const chunkEmbeddings = this.db.getChunksWithEmbeddings(owner, repo);
    if (chunkEmbeddings.length === 0) {
      return {
        question,
        owner,
        repo,
        evidence: [],
      };
    }

    // Embed the query
    const queryVector = await this.embedder.embedText(question);

    // Compute similarities
    const scoredChunks = chunkEmbeddings.map(({ chunk, embedding }) => {
      const score = cosineSimilarity(queryVector, embedding.vector);
      return { chunk, score };
    });

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Take top K
    const topItems = scoredChunks.slice(0, topK);

    const evidence: EvidenceItem[] = topItems.map(({ chunk, score }) => {
      // Excerpt clean preview (up to 300 characters)
      const excerpt = chunk.text.length > 300
        ? `${chunk.text.slice(0, 300).trim()}...`
        : chunk.text;

      return {
        chunkId: chunk.id,
        recordId: chunk.recordId,
        type: chunk.sourceType,
        title: chunk.sourceTitle,
        url: chunk.sourceUrl,
        excerpt,
        similarity: parseFloat(score.toFixed(4)),
        timestamp: chunk.timestamp,
      };
    });

    return {
      question,
      owner,
      repo,
      evidence,
    };
  }
}

export const historyRetriever = new HistoryRetriever();
