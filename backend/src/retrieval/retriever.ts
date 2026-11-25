import { RETRIEVAL_CONFIG } from '../config';
import { database, RepositoryDatabase } from '../db/database';
import { githubClient, GitHubGraphQLClient } from '../github/client';
import {
  EvidenceItem,
  IngestSummary,
  RetrievalResult,
  SourceType,
  TextChunk,
} from '../types';
import { chunkRecords, extractBodyText } from './chunker';
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

    // Step 1: Fetch history from GitHub GraphQL (no database writes yet)
    options.onProgress?.('Fetching history from GitHub GraphQL...');
    const history = await this.client.fetchRepositoryHistory(owner, repo);

    // Step 2: Chunk records (in-memory)
    options.onProgress?.('Chunking records...');
    const chunks = chunkRecords(history.records);

    // Step 3: Generate embeddings (API call, no database writes yet)
    options.onProgress?.(`Generating embeddings (${chunks.length} chunks)...`);
    const embeddings = await this.embedder.embedChunks(
      chunks,
      (current, total) => {
        options.onProgress?.('Embedding chunks', { current, total });
      }
    );

    // Step 4: After fetch, chunk, and embed all succeed, replace old data and save all data in one atomic transaction, marking fresh LAST
    options.onProgress?.('Saving records and embeddings to SQLite cache...');
    this.db.saveRepositoryData(owner, repo, history, chunks, embeddings);

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
   * Retrieves top-K relevant evidence items for a given question using cosine similarity over embeddings,
   * keeping only the best chunk per record, skipping empty-body records, and expanding with linked items.
   */
  async retrieveEvidence(
    owner: string,
    repo: string,
    question: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievalResult> {
    const topK = options.topK || RETRIEVAL_CONFIG.TOP_K;
    const maxEvidenceCap = 12;

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

    // Filter out chunks with empty body
    const nonEmptyChunks = scoredChunks.filter(({ chunk }) => {
      const bodyText = extractBodyText(chunk.text);
      return bodyText.length > 0;
    });

    // Sort descending by score
    nonEmptyChunks.sort((a, b) => b.score - a.score);

    // Keep only the best chunk per record
    const seenRecordIds = new Set<string>();
    const bestChunksByRecord: Array<{ chunk: TextChunk; score: number }> = [];

    for (const item of nonEmptyChunks) {
      if (!seenRecordIds.has(item.chunk.recordId)) {
        seenRecordIds.add(item.chunk.recordId);
        bestChunksByRecord.push(item);
      }
    }

    // Take top K primary matches
    const primaryItems = bestChunksByRecord.slice(0, topK);

    // Build primary evidence items
    const evidence: EvidenceItem[] = primaryItems.map(({ chunk, score }) => {
      const bodyText = extractBodyText(chunk.text);
      const excerpt = bodyText.length > 300
        ? `${bodyText.slice(0, 300).trim()}...`
        : bodyText;

      const linkedPrs = this.db.getLinkedPrsForRecord(chunk.recordId);

      return {
        chunkId: chunk.id,
        recordId: chunk.recordId,
        type: chunk.sourceType,
        title: chunk.sourceTitle,
        url: chunk.sourceUrl,
        excerpt,
        similarity: parseFloat(score.toFixed(4)),
        timestamp: chunk.timestamp,
        fullText: chunk.text,
        linkedPrs,
      };
    });

    // Expand with linked records from relationships if space remains (up to maxEvidenceCap)
    if (evidence.length < maxEvidenceCap && primaryItems.length > 0) {
      const primaryRecordIds = primaryItems.map((item) => item.chunk.recordId);
      const relatedRecordIds = this.db.getRelatedRecordIds(primaryRecordIds);

      // Filter out records already in evidence
      const newRelatedIds = relatedRecordIds.filter((id) => !seenRecordIds.has(id));

      if (newRelatedIds.length > 0) {
        const relatedChunks = this.db.getChunksForRecords(newRelatedIds);
        // Map chunks by recordId, taking only the first non-empty chunk per record
        const relatedByRecord = new Map<string, TextChunk>();
        for (const rChunk of relatedChunks) {
          if (!relatedByRecord.has(rChunk.recordId)) {
            const bodyText = extractBodyText(rChunk.text);
            if (bodyText.length > 0) {
              relatedByRecord.set(rChunk.recordId, rChunk);
            }
          }
        }

        for (const [rId, rChunk] of relatedByRecord.entries()) {
          if (evidence.length >= maxEvidenceCap) break;
          seenRecordIds.add(rId);

          const bodyText = extractBodyText(rChunk.text);
          const excerpt = bodyText.length > 300
            ? `${bodyText.slice(0, 300).trim()}...`
            : bodyText;

          const linkedPrs = this.db.getLinkedPrsForRecord(rChunk.recordId);

          evidence.push({
            chunkId: rChunk.id,
            recordId: rChunk.recordId,
            type: rChunk.sourceType,
            title: rChunk.sourceTitle,
            url: rChunk.sourceUrl,
            excerpt,
            similarity: 0.5,
            timestamp: rChunk.timestamp,
            fullText: rChunk.text,
            linkedPrs,
          });
        }
      }
    }

    return {
      question,
      owner,
      repo,
      evidence,
    };
  }
}

export const historyRetriever = new HistoryRetriever();
