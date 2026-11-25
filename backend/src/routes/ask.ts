import { Router, Request, Response, NextFunction } from 'express';
import { askRequestSchema } from '../lib/validate';
import { NotImplementedError } from '../lib/errors';

export const askRouter = Router();

askRouter.post(
  '/api/ask',
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate request payload with Zod schema (rejects unknown fields, validates types)
      const validated = askRequestSchema.parse(req.body);

      // Log clean diagnostic info without secrets
      console.log(`[Ask Request] Received query for ${validated.owner}/${validated.repo}`);

      // In Session 1, retrieval and Gemini do not exist yet.
      // Must return honest HTTP 501 not_implemented, never fake data.
      throw new NotImplementedError(
        'Repository history retrieval and AI answering are not implemented yet.'
      );
    } catch (err) {
      next(err);
    }
  }
);
