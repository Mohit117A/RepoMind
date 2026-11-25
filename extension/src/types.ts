/**
 * Shared Request and Response Types for RepoMind.
 *
 * NOTE: backend/src/types.ts must be kept identical to this file.
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
