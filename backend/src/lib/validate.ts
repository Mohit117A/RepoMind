import { z } from 'zod';

/**
 * Validation patterns for GitHub repository identification.
 * owner: letters, digits, hyphen, 1 to 39 characters.
 * repo: letters, digits, dot, underscore, hyphen, 1 to 100 characters, not "." or "..".
 */
export const OWNER_REGEX = /^[a-zA-Z0-9-]+$/;
export const REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

export const askRequestSchema = z
  .object({
    owner: z
      .string({ required_error: 'Owner is required' })
      .min(1, 'Owner cannot be empty')
      .max(39, 'Owner cannot exceed 39 characters')
      .regex(
        OWNER_REGEX,
        'Owner may only contain letters, numbers, and hyphens'
      ),
    repo: z
      .string({ required_error: 'Repo is required' })
      .min(1, 'Repo cannot be empty')
      .max(100, 'Repo cannot exceed 100 characters')
      .regex(
        REPO_REGEX,
        'Repo may only contain letters, numbers, dots, underscores, and hyphens'
      )
      .refine((val) => val !== '.' && val !== '..', {
        message: 'Repo name cannot be "." or ".."',
      }),
    question: z
      .string({ required_error: 'Question is required' })
      .trim()
      .min(3, 'Question must be at least 3 characters long')
      .max(500, 'Question cannot exceed 500 characters'),
  })
  .strict({
    message: 'Unknown fields are not allowed',
  });

export type ValidatedAskRequest = z.infer<typeof askRequestSchema>;
