import { describe, it, expect, vi } from 'vitest';
import {
  GeminiAnswerGenerator,
  INSUFFICIENT_EVIDENCE_SENTENCE,
} from './generator';
import { EvidenceItem } from '../types';

describe('GeminiAnswerGenerator', () => {
  const sampleEvidence: EvidenceItem[] = [
    {
      chunkId: 'chunk-1',
      recordId: 'owner/repo/pr-1',
      type: 'pull_request',
      title: 'PR #1: Add auth tokens',
      url: 'https://github.com/owner/repo/pull/1',
      excerpt: 'Implemented bearer token verification.',
      similarity: 0.95,
      timestamp: '2026-11-20T10:00:00Z',
      fullText:
        '[PULL_REQUEST] PR #1: Add auth tokens\nURL: https://github.com/owner/repo/pull/1\n\nImplemented bearer token verification.',
    },
    {
      chunkId: 'chunk-2',
      recordId: 'owner/repo/issue-2',
      type: 'issue',
      title: 'Issue #2: Insecure session cookies',
      url: 'https://github.com/owner/repo/issues/2',
      excerpt: 'Session cookies were vulnerable to CSRF.',
      similarity: 0.88,
      timestamp: '2026-11-19T10:00:00Z',
      fullText:
        '[ISSUE] Issue #2: Insecure session cookies\nURL: https://github.com/owner/repo/issues/2\n\nSession cookies were vulnerable to CSRF.',
    },
  ];

  it('generates a supported answer with valid citations', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Auth tokens were introduced to replace vulnerable session cookies.',
                    evidenceStatus: 'supported',
                    citedIds: [1, 2],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    const result = await generator.generateAnswer(
      'Why were auth tokens added?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('supported');
    expect(result.answer).toBe('Auth tokens were introduced to replace vulnerable session cookies.');
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].url).toBe('https://github.com/owner/repo/pull/1');
    expect(result.sources[0].excerpt).toBe('Implemented bearer token verification.');
    expect(result.sources[1].url).toBe('https://github.com/owner/repo/issues/2');
  });

  it('returns insufficient evidence when Gemini determines evidence is insufficient', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Insufficient info',
                    evidenceStatus: 'insufficient',
                    citedIds: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    const result = await generator.generateAnswer(
      'Why did Fastify switch to Vue?',
      'fastify',
      'fastify',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('drops unknown citation IDs and falls back to insufficient if no valid citations remain', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Something happened.',
                    evidenceStatus: 'supported',
                    citedIds: [999, 1000], // Unknown IDs
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    const result = await generator.generateAnswer(
      'Why was feature X added?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('rejects URLs written in the answer and falls back to insufficient evidence', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Check out https://github.com/owner/repo/pull/1 for more details.',
                    evidenceStatus: 'supported',
                    citedIds: [1],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    const result = await generator.generateAnswer(
      'Why was this added?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('throws malformed_output when candidate JSON is invalid', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Not JSON at all',
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    await expect(
      generator.generateAnswer('Question', 'owner', 'repo', sampleEvidence)
    ).rejects.toThrow(/not valid JSON/i);
  });

  it('handles API errors cleanly without leaking keys', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          message: 'The provided API key test-secret-key is invalid',
        },
      }),
    });

    const generator = new GeminiAnswerGenerator('test-secret-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    await expect(
      generator.generateAnswer('Question', 'owner', 'repo', sampleEvidence)
    ).rejects.toThrow(/\[REDACTED\]/);
  });

  it('retries up to 2 times on HTTP 503 and returns clear "AI model is busy, try again" error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: {
          code: 503,
          message: 'Model is overloaded',
        },
      }),
    });

    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
    
    await expect(
      generator.generateAnswer('Question', 'owner', 'repo', sampleEvidence)
    ).rejects.toThrow('AI model is busy, try again');

    // 1 initial attempt + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns insufficient evidence immediately without calling Gemini when evidence is empty', async () => {
    const mockFetch = vi.fn();
    const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);

    const result = await generator.generateAnswer('Any question', 'owner', 'repo', []);

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
