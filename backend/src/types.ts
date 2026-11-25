/**
 * Shared Request, Response, and Domain Types for RepoMind.
 *
 * NOTE: extension/src/types.ts must be kept compatible with the frontend contracts.
 */

export type SourceType =
  | 'pull_request'
  | 'issue'
  | 'commit'
  | 'review'
  | 'comment';

export interface SourceCitation {
  type: SourceType;
  title: string;
  url: string;
  excerpt: string;
}

export type EvidenceStatus = 'supported' | 'insufficient';

export interface AskRequest {
  owner: string;
  repo: string;
  question: string;
}

export interface AskResponse {
  answer: string;
  evidenceStatus: EvidenceStatus;
  sources: SourceCitation[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

// ---------------------------------------------------------
// Phase 2: GitHub Domain and Normalized History Record Types
// ---------------------------------------------------------

export interface NormalizedRecord {
  /** Synthetic unique ID within repo, e.g. "pr-123", "issue-456", "commit-abc1234", "review-789", "comment-999" */
  id: string;
  repoOwner: string;
  repoName: string;
  type: SourceType;
  githubId: string; // PR number, issue number, commit oid, or node id
  url: string;
  title: string;
  body: string;
  author: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface NormalizedRelationship {
  parentRecordId: string;
  childRecordId: string;
  relationshipType: 'pr_issue' | 'pr_commit' | 'pr_review' | 'pr_comment' | 'issue_comment' | 'review_comment';
}

export interface FetchHistoryResult {
  records: NormalizedRecord[];
  relationships: NormalizedRelationship[];
  prCount: number;
  isTruncated: boolean;
  fetchedAt: string;
}

// ---------------------------------------------------------
// Phase 3: Chunking, Database, and Retrieval Types
// ---------------------------------------------------------

export interface TextChunk {
  id: string;
  recordId: string;
  repoOwner: string;
  repoName: string;
  chunkIndex: number;
  text: string;
  sourceType: SourceType;
  sourceTitle: string;
  sourceUrl: string;
  timestamp: string;
}

export interface ChunkEmbedding {
  chunkId: string;
  model: string;
  vector: number[];
  dimensions: number;
}

export interface EvidenceItem {
  chunkId: string;
  recordId: string;
  type: SourceType;
  title: string;
  url: string;
  excerpt: string;
  similarity: number;
  timestamp: string;
  fullText?: string;
}

export interface IngestSummary {
  owner: string;
  repo: string;
  cached: boolean;
  isTruncated: boolean;
  counts: {
    pullRequests: number;
    issues: number;
    reviews: number;
    comments: number;
    commits: number;
    totalRecords: number;
    relationships: number;
    chunks: number;
    embeddings: number;
  };
  fetchedAt: string;
}

export interface RetrievalResult {
  question: string;
  owner: string;
  repo: string;
  evidence: EvidenceItem[];
}
