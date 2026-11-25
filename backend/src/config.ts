import path from 'path';
import dotenv from 'dotenv';

// Load .env from backend directory first, then root directory if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface Config {
  port: number;
  githubToken: string | undefined;
  geminiApiKey: string | undefined;
  geminiModel: string;
  databasePath: string;
}

const defaultDbPath = path.resolve(
  __dirname,
  '../../backend/data/repomind.db'
);

function resolveDatabasePath(rawPath?: string): string {
  if (!rawPath || rawPath === ':memory:') {
    return rawPath || defaultDbPath;
  }
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  const rootDir = process.cwd().endsWith('backend')
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
  return path.resolve(rootDir, rawPath);
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  githubToken: process.env.GITHUB_TOKEN || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  databasePath: resolveDatabasePath(process.env.DATABASE_PATH),
};

/**
 * Constants governing GitHub GraphQL fetching limits, cache TTL, and retrieval.
 */
export const GITHUB_LIMITS = {
  MAX_PRS: 20,
  MAX_REVIEWS_PER_PR: 5,
  MAX_COMMENTS_PER_PR: 5,
  MAX_REVIEW_COMMENTS_PER_REVIEW: 5,
  MAX_CLOSING_ISSUES_PER_PR: 5,
  MAX_ISSUE_COMMENTS_PER_ISSUE: 5,
  MAX_COMMITS_PER_PR: 5,
} as const;

export const RETRIEVAL_CONFIG = {
  TOP_K: 5,
  CHUNK_MAX_CHARS: 800,
  CHUNK_OVERLAP_CHARS: 100,
  EMBEDDING_MODEL: 'gemini-embedding-001',
  CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Validates configuration at startup.
 * Non-fatal warnings for missing tokens so /health and unit tests pass without tokens.
 * Ingest and retrieve operations explicitly check for tokens when invoked.
 * NEVER log secrets.
 */
export function validateConfig(): void {
  if (!config.githubToken) {
    console.warn(
      '[Config Warning] GITHUB_TOKEN is not set. Ingesting from GitHub GraphQL will require this variable.'
    );
  }
  if (!config.geminiApiKey) {
    console.warn(
      '[Config Warning] GEMINI_API_KEY is not set. Generating embeddings will require this variable.'
    );
  }
}
