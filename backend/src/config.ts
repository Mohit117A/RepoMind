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
  databasePath: string | undefined;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  githubToken: process.env.GITHUB_TOKEN || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  databasePath: process.env.DATABASE_PATH || undefined,
};

/**
 * Validates configuration at startup.
 * In Session 1, missing GITHUB_TOKEN and GEMINI_API_KEY print warnings
 * because retrieval and Gemini answering are not implemented yet.
 *
 * NOTE: This will become a hard startup error once Phase 2 (GitHub GraphQL)
 * and Phase 4 (Gemini LLM) are implemented.
 * NEVER log the secret values themselves.
 */
export function validateConfig(): void {
  if (!config.githubToken) {
    console.warn(
      '[Config Warning] GITHUB_TOKEN is not set. (Acceptable for Session 1; required in Phase 2)'
    );
  }
  if (!config.geminiApiKey) {
    console.warn(
      '[Config Warning] GEMINI_API_KEY is not set. (Acceptable for Session 1; required in Phase 4)'
    );
  }
}
