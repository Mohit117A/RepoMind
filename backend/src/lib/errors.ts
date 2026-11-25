import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code: string = 'bad_request') {
    super(400, code, message);
  }
}

export class NotImplementedError extends AppError {
  constructor(
    message: string = 'Repository history retrieval and AI answering are not implemented yet.'
  ) {
    super(501, 'not_implemented', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, 'not_found', message);
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
      : 'Validation failed';

    res.status(400).json({
      error: {
        code: 'bad_request',
        message,
      },
    });
    return;
  }

  // Handle known AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Handle SyntaxError (e.g. malformed JSON in request body)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      error: {
        code: 'bad_request',
        message: 'Malformed JSON payload',
      },
    });
    return;
  }

  // Generic internal server error
  console.error('[Internal Error]', {
    path: req.path,
    method: req.method,
    message: err instanceof Error ? err.message : 'Unknown error',
  });

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An internal server error occurred',
    },
  });
}
