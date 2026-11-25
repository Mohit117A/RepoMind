import { AskRequest, AskResponse, ApiError } from '../types';

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  'http://localhost:3001';

export class BackendError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Sends a question regarding a specific repository to the RepoMind backend.
 * Uses a default 60-second timeout with cancel support.
 */
export async function askQuestion(
  request: AskRequest,
  externalSignal?: AbortSignal
): Promise<AskResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  // Link external abort signal if provided
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const url = `${BACKEND_URL.replace(/\/+$/, '')}/api/ask`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      if (json && typeof json === 'object' && 'error' in json) {
        const apiError = json as ApiError;
        throw new BackendError(
          apiError.error.message,
          apiError.error.code,
          response.status
        );
      }

      throw new BackendError(
        `Server returned error ${response.status}`,
        'http_error',
        response.status
      );
    }

    return json as AskResponse;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof BackendError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new BackendError(
        'Request timed out after 60 seconds.',
        'timeout'
      );
    }

    // Network error / connection refused
    throw new BackendError(
      "RepoMind couldn't reach its server. Is the backend running?",
      'network_error'
    );
  }
}
