import { Router, Request, Response, NextFunction } from 'express';
import { askRequestSchema } from '../lib/validate';
import { historyRetriever, HistoryRetriever } from '../retrieval/retriever';
import { geminiAnswerGenerator, GeminiAnswerGenerator } from '../llm/generator';
import { AskResponse } from '../types';

export const askRouter = Router();

// In-memory concurrency map to deduplicate in-flight ingestions for the same repository
export const pendingIngests = new Map<string, Promise<unknown>>();

export function getRepoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function createAskHandler(
  retriever: HistoryRetriever = historyRetriever,
  generator: GeminiAnswerGenerator = geminiAnswerGenerator
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request payload with Zod schema (rejects unknown fields, validates types)
      const validated = askRequestSchema.parse(req.body);
      const { owner, repo, question } = validated;
      const repoKey = getRepoKey(owner, repo);

      // Log clean diagnostic info without secrets
      console.log(`[Ask Request] Received query for ${owner}/${repo}`);

      // 1. Ingest (or wait if an ingest for this repository is already in progress)
      let ingestPromise = pendingIngests.get(repoKey);
      if (!ingestPromise) {
        ingestPromise = retriever
          .ingestRepository(owner, repo)
          .finally(() => {
            pendingIngests.delete(repoKey);
          });
        pendingIngests.set(repoKey, ingestPromise);
      }

      await ingestPromise;

      // 2. Retrieve top evidence items
      const retrieval = await retriever.retrieveEvidence(owner, repo, question);

      // 3. Generate grounded answer
      const result: AskResponse = await generator.generateAnswer(
        question,
        owner,
        repo,
        retrieval.evidence
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

askRouter.post('/api/ask', createAskHandler());
