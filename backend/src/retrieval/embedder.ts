import { config, RETRIEVAL_CONFIG } from '../config';
import { AppError } from '../lib/errors';
import { ChunkEmbedding, TextChunk } from '../types';

export class GeminiEmbeddingError extends AppError {
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, code, message);
    this.name = 'GeminiEmbeddingError';
  }
}

export interface EmbedderOptions {
  apiKey?: string;
  model?: string;
  endpointBase?: string;
}

export class GeminiEmbedder {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpointBase: string;

  constructor(options: EmbedderOptions = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.geminiApiKey;
    this.model = options.model || RETRIEVAL_CONFIG.EMBEDDING_MODEL;
    this.endpointBase =
      options.endpointBase || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Generates embedding vector for a single text string using Gemini API.
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new GeminiEmbeddingError(
        401,
        'missing_gemini_api_key',
        'GEMINI_API_KEY is not configured. An API key from Google AI Studio is required for embedding retrieval.'
      );
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new GeminiEmbeddingError(
        400,
        'empty_text_embedding',
        'Cannot generate embeddings for an empty text.'
      );
    }

    const url = `${this.endpointBase}/models/${this.model}:embedContent?key=${this.apiKey}`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: cleanText }],
          },
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new GeminiEmbeddingError(
        503,
        'gemini_network_error',
        `Failed to reach Gemini API for embeddings: ${message}`
      );
    }

    if (response.status === 400 || response.status === 403) {
      const errorJson = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const detail = errorJson.error?.message || response.statusText;
      throw new GeminiEmbeddingError(
        response.status,
        'invalid_gemini_api_key',
        `Gemini API rejected request: ${detail}`
      );
    }

    if (response.status === 429) {
      throw new GeminiEmbeddingError(
        429,
        'gemini_rate_limit',
        'Gemini API rate limit exceeded during embedding generation.'
      );
    }

    if (!response.ok) {
      throw new GeminiEmbeddingError(
        response.status,
        'gemini_embedding_failed',
        `Gemini API returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      embedding?: {
        values?: number[];
      };
    };

    if (!data.embedding?.values || !Array.isArray(data.embedding.values)) {
      throw new GeminiEmbeddingError(
        502,
        'gemini_invalid_embedding_response',
        'Gemini API response did not contain embedding vector values.'
      );
    }

    return data.embedding.values;
  }

  /**
   * Embeds multiple chunks in controlled batches, reporting progress if requested.
   */
  async embedChunks(
    chunks: TextChunk[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ChunkEmbedding[]> {
    const results: ChunkEmbedding[] = [];
    const total = chunks.length;
    let completed = 0;

    for (const chunk of chunks) {
      const vector = await this.embedText(chunk.text);
      results.push({
        chunkId: chunk.id,
        model: this.model,
        vector,
        dimensions: vector.length,
      });

      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }

      // Small pause to avoid hitting strict rate limits
      if (chunks.length > 5) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return results;
  }
}

export const geminiEmbedder = new GeminiEmbedder();
