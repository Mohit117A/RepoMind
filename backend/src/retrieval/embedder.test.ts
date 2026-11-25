import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiEmbedder, GeminiEmbeddingError } from './embedder';

describe('GeminiEmbedder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws 504 timeout error when embedding request times out', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const embedder = new GeminiEmbedder({ apiKey: 'test-key' });

    await expect(embedder.embedText('Sample text')).rejects.toThrow(
      'Gemini embedding request timed out after 30 seconds'
    );
  });

  it('throws error when GEMINI_API_KEY is not configured', async () => {
    const embedder = new GeminiEmbedder({ apiKey: '' });

    await expect(embedder.embedText('Sample text')).rejects.toThrow(
      'GEMINI_API_KEY is not configured'
    );
  });
});
