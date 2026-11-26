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
        '[PULL_REQUEST] PR #1: Add auth tokens\nState: MERGED\nURL: https://github.com/owner/repo/pull/1\n\nImplemented bearer token verification.',
      linkedPrs: [
        {
          id: 'owner/repo/pr-1',
          githubId: '1',
          title: 'PR #1: Add auth tokens',
          state: 'MERGED',
          url: 'https://github.com/owner/repo/pull/1',
        },
      ],
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
      linkedPrs: [
        {
          id: 'owner/repo/pr-1',
          githubId: '1',
          title: 'PR #1: Add auth tokens',
          state: 'MERGED',
          url: 'https://github.com/owner/repo/pull/1',
        },
      ],
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

  it('appends unmerged notice if a supported answer cites no MERGED PR', async () => {
    const unmergedEvidence: EvidenceItem[] = [
      {
        chunkId: 'chunk-open-1',
        recordId: 'owner/repo/pr-10',
        type: 'pull_request',
        title: 'PR #10: Proposed new validation rule',
        url: 'https://github.com/owner/repo/pull/10',
        excerpt: 'Proposed stricter validation for schema.',
        similarity: 0.92,
        timestamp: '2026-11-20T10:00:00Z',
        fullText:
          '[PULL_REQUEST] PR #10: Proposed new validation rule\nState: OPEN\nURL: https://github.com/owner/repo/pull/10\n\nProposed stricter validation for schema.',
        linkedPrs: [
          {
            id: 'owner/repo/pr-10',
            githubId: '10',
            title: 'PR #10: Proposed new validation rule',
            state: 'OPEN',
            url: 'https://github.com/owner/repo/pull/10',
          },
        ],
      },
    ];

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
                    answer: 'A new validation rule was proposed to catch invalid schema inputs.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was the rule changed?',
      'owner',
      'repo',
      unmergedEvidence
    );

    expect(result.evidenceStatus).toBe('supported');
    expect(result.answer).toContain('The cited evidence does not show that this change was merged.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe('https://github.com/owner/repo/pull/10');
  });

  it('throws 504 timeout error when request to Gemini times out', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    await expect(
      generator.generateAnswer('Question', 'owner', 'repo', sampleEvidence)
    ).rejects.toThrow('Gemini generation request timed out after 30 seconds');
  });

  it('includes any PR or issue numbers named in the answer in sources using stored records', async () => {
    const evidenceWithLinkedPr: EvidenceItem[] = [
      {
        chunkId: 'chunk-issue-1',
        recordId: 'owner/repo/issue-50',
        type: 'issue',
        title: 'Issue #50: Schema crash',
        url: 'https://github.com/owner/repo/issues/50',
        excerpt: 'Schema crash details',
        similarity: 0.9,
        timestamp: '2026-11-20T10:00:00Z',
        linkedPrs: [],
      },
      {
        chunkId: 'chunk-pr-7256',
        recordId: 'owner/repo/pr-7256',
        type: 'pull_request',
        title: 'PR #7256: Fix schema crash proposal',
        url: 'https://github.com/owner/repo/pull/7256',
        excerpt: 'State: MERGED\nFix schema crash',
        similarity: 0.8,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFix schema crash',
      },
    ];

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
                    // Mentioning PR #7256 in answer even though citedIds only had [1] (Issue #50)
                    answer: 'PR #7256 addressed this schema crash in issue #50.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      evidenceWithLinkedPr
    );

    expect(result.evidenceStatus).toBe('supported');
    // Both Issue #50 and PR #7256 must be present in sources
    const urls = result.sources.map((s) => s.url);
    expect(urls).toContain('https://github.com/owner/repo/issues/50');
    expect(urls).toContain('https://github.com/owner/repo/pull/7256');
  });

  it('speaks directly and cleans up "The user assumes" meta-commentary', async () => {
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
                    answer:
                      'The user assumes a change has happened, but the evidence only shows proposals. This was proposed to fix a bug.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.answer).not.toMatch(/^the user assumes/i);
    expect(result.answer).toContain('The evidence shows open proposals rather than a merged change');
  });

  it('rule 1: returns insufficient when citedIds has no valid IDs even if numbers are named in answer', async () => {
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
                    answer: 'This was changed in PR #7267.',
                    evidenceStatus: 'supported',
                    citedIds: [], // empty citedIds
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('rule 4: returns insufficient when unknown number is named in answer', async () => {
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
                    answer: 'Auth tokens were introduced in #9999 to replace session cookies.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('rule 4: allows number when it is written in a cited item text', async () => {
    const evidenceWithTextMention: EvidenceItem[] = [
      {
        chunkId: 'chunk-1',
        recordId: 'owner/repo/pr-1',
        type: 'pull_request',
        title: 'PR #1: Fix bug',
        url: 'https://github.com/owner/repo/pull/1',
        excerpt: 'State: MERGED\nFixes issue reported in RFC 10008 and discussion #42.',
        similarity: 0.95,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFixes issue reported in RFC 10008 and discussion #42.',
        linkedPrs: [],
      },
    ];

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
                    answer: 'This was implemented per discussion #42.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      evidenceWithTextMention
    );

    expect(result.evidenceStatus).toBe('supported');
    expect(result.answer).toContain('This was implemented per discussion #42');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe('https://github.com/owner/repo/pull/1');
  });

  it('rule 3: matches exact numbers (#72 beside #7246 is not treated as matched by #7246)', async () => {
    const evidenceWith7246: EvidenceItem[] = [
      {
        chunkId: 'chunk-1',
        recordId: 'owner/repo/pr-7246',
        type: 'pull_request',
        title: 'PR #7246: Fix error handling',
        url: 'https://github.com/owner/repo/pull/7246',
        excerpt: 'State: MERGED\nFixed error handling',
        similarity: 0.95,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFixed error handling',
        linkedPrs: [],
      },
    ];

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
                    // #72 is mentioned, but only #7246 is in evidence!
                    answer: 'This was changed in PR #72.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      evidenceWith7246
    );

    // #72 is not in evidence or cited item text -> must be rejected as insufficient
    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  it('rule 6: does not add merge sentence when cited evidence has no PRs at all (issue only)', async () => {
    const issueEvidence: EvidenceItem[] = [
      {
        chunkId: 'chunk-issue-1',
        recordId: 'owner/repo/issue-100',
        type: 'issue',
        title: 'Issue #100: Bug report',
        url: 'https://github.com/owner/repo/issues/100',
        excerpt: 'Discussion about bug',
        similarity: 0.9,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'Discussion about bug',
        linkedPrs: [],
      },
    ];

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
                    answer: 'Issue #100 reports that the service crashed.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why does it crash?',
      'owner',
      'repo',
      issueEvidence
    );

    expect(result.evidenceStatus).toBe('supported');
    // Issue only: no PR involved, so no merge sentence should be added
    expect(result.answer).not.toContain('The cited evidence does not show that this change was merged.');
  });

  it('rule 6: adds merge sentence when an open PR is cited', async () => {
    const openPrEvidence: EvidenceItem[] = [
      {
        chunkId: 'chunk-pr-1',
        recordId: 'owner/repo/pr-200',
        type: 'pull_request',
        title: 'PR #200: Proposed fix',
        url: 'https://github.com/owner/repo/pull/200',
        excerpt: 'State: OPEN\nProposed refactor',
        similarity: 0.9,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: OPEN\nProposed refactor',
        linkedPrs: [],
      },
    ];

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
                    answer: 'A refactor was proposed in PR #200.',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was it changed?',
      'owner',
      'repo',
      openPrEvidence
    );

    expect(result.evidenceStatus).toBe('supported');
    expect(result.answer).toContain('The cited evidence does not show that this change was merged.');
  });

  it('rule 5: renumbers claim markers [n] to match returned sources order, including duplicate URLs', async () => {
    const multiEvidence: EvidenceItem[] = [
      {
        chunkId: 'chunk-1',
        recordId: 'owner/repo/pr-1',
        type: 'pull_request',
        title: 'PR #1: Feature A',
        url: 'https://github.com/owner/repo/pull/1',
        excerpt: 'State: MERGED\nFeature A details',
        similarity: 0.9,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFeature A details',
      },
      {
        chunkId: 'chunk-2',
        recordId: 'owner/repo/pr-1-part2',
        type: 'pull_request',
        title: 'PR #1: Feature A more details',
        url: 'https://github.com/owner/repo/pull/1', // Same URL as chunk-1!
        excerpt: 'State: MERGED\nFeature A extra details',
        similarity: 0.85,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFeature A extra details',
      },
      {
        chunkId: 'chunk-3',
        recordId: 'owner/repo/issue-3',
        type: 'issue',
        title: 'Issue #3: Feature B',
        url: 'https://github.com/owner/repo/issues/3',
        excerpt: 'Feature B request',
        similarity: 0.8,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'Feature B request',
      },
    ];

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
                    // Citing item 3 first, then item 2 (which shares URL with item 1)
                    answer: 'Feature B was requested in [3]. Feature A was implemented in [2].',
                    evidenceStatus: 'supported',
                    citedIds: [3, 2],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      multiEvidence
    );

    expect(result.evidenceStatus).toBe('supported');
    expect(result.sources).toHaveLength(2);
    // Source 1 is Issue #3 (citedId 3)
    expect(result.sources[0].url).toBe('https://github.com/owner/repo/issues/3');
    // Source 2 is PR #1 (citedId 2)
    expect(result.sources[1].url).toBe('https://github.com/owner/repo/pull/1');
    // Renumbered markers: [3] -> [1], [2] -> [2]
    expect(result.answer).toContain('Feature B was requested in [1]');
    expect(result.answer).toContain('Feature A was implemented in [2]');
  });

  it('rule 5: rejects invalid marker [n] with no source and returns insufficient', async () => {
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
                    // [99] does not exist in evidence
                    answer: 'Feature was added [99].',
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

    const generator = new GeminiAnswerGenerator(
      'test-api-key',
      'gemini-3.5-flash-lite',
      mockFetch as unknown as typeof fetch
    );

    const result = await generator.generateAnswer(
      'Why was this changed?',
      'owner',
      'repo',
      sampleEvidence
    );

    expect(result.evidenceStatus).toBe('insufficient');
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
    expect(result.sources).toEqual([]);
  });

  describe('grouped citation markers and code span handling', () => {
    const multiEvidence: EvidenceItem[] = [
      {
        chunkId: 'chunk-1',
        recordId: 'owner/repo/pr-1',
        type: 'pull_request',
        title: 'PR #1: Commit 1',
        url: 'https://github.com/owner/repo/pull/1',
        excerpt: 'State: MERGED\nDetails 1',
        similarity: 0.9,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nDetails 1',
      },
      {
        chunkId: 'chunk-2',
        recordId: 'owner/repo/issue-2',
        type: 'issue',
        title: 'Issue #2: Report 2',
        url: 'https://github.com/owner/repo/issues/2',
        excerpt: 'Report 2 details',
        similarity: 0.85,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'Report 2 details',
      },
      {
        chunkId: 'chunk-3',
        recordId: 'owner/repo/pr-3',
        type: 'pull_request',
        title: 'PR #3: Fix 3',
        url: 'https://github.com/owner/repo/pull/3',
        excerpt: 'State: MERGED\nFix 3 details',
        similarity: 0.8,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFix 3 details',
      },
      {
        chunkId: 'chunk-4',
        recordId: 'owner/repo/pr-4',
        type: 'pull_request',
        title: 'PR #4: Fix 4',
        url: 'https://github.com/owner/repo/pull/4',
        excerpt: 'State: MERGED\nFix 4 details',
        similarity: 0.75,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFix 4 details',
      },
      {
        chunkId: 'chunk-5',
        recordId: 'owner/repo/pr-5',
        type: 'pull_request',
        title: 'PR #5: Fix 5 (shares URL with PR 3)',
        url: 'https://github.com/owner/repo/pull/3',
        excerpt: 'State: MERGED\nFix 3 duplicate details',
        similarity: 0.7,
        timestamp: '2026-11-20T10:00:00Z',
        fullText: 'State: MERGED\nFix 3 duplicate details',
      },
    ];

    it('correctly renumbers grouped markers like [3, 4, 1] into separate markers [1][2][3]', async () => {
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
                      answer: 'Changes were proposed in [3, 4, 1].',
                      evidenceStatus: 'supported',
                      citedIds: [3, 4, 1],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('supported');
      expect(result.sources).toHaveLength(3);
      // Sources order: 3 -> [1], 4 -> [2], 1 -> [3]
      expect(result.answer).toContain('[1][2][3]');
    });

    it('handles compact grouped markers [3,4] and adjacent markers [3][4]', async () => {
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
                      answer: 'Grouped in [3,4] and adjacent in [3][4].',
                      evidenceStatus: 'supported',
                      citedIds: [3, 4],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('supported');
      expect(result.sources).toHaveLength(2);
      expect(result.answer).toContain('Grouped in [1][2] and adjacent in [1][2]');
    });

    it('deduplicates grouped markers that map to the same source URL', async () => {
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
                      // 3 and 5 share the same URL
                      answer: 'Reported in [3, 5].',
                      evidenceStatus: 'supported',
                      citedIds: [3, 5],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('supported');
      expect(result.sources).toHaveLength(1);
      // Both 3 and 5 map to source 1, so [3, 5] deduplicates to [1]
      expect(result.answer).toContain('Reported in [1]');
      expect(result.answer).not.toContain('[1][1]');
    });

    it('does not treat bracketed numbers inside backtick code spans (like `response[200]`) as citations', async () => {
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
                      answer: 'When accessing `schema.response[200].content` it threw an error [1].',
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
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('supported');
      expect(result.sources).toHaveLength(1);
      expect(result.answer).toContain('`schema.response[200].content`');
      expect(result.answer).toContain('it threw an error [1]');
    });

    it('rejects range markers like [3-5] and returns insufficient', async () => {
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
                      answer: 'Refer to items [3-5] for details.',
                      evidenceStatus: 'supported',
                      citedIds: [3, 4, 5],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const generator = new GeminiAnswerGenerator('test-api-key', 'gemini-3.5-flash-lite', mockFetch as unknown as typeof fetch);
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('insufficient');
      expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
      expect(result.sources).toEqual([]);
    });

    it('rejects marker when number inside grouped marker cannot be mapped to a source', async () => {
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
                      answer: 'Addressed in [1, 99].',
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
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('insufficient');
      expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
      expect(result.sources).toEqual([]);
    });

    it('final check: rejects response if a marker value is outside 1..sources.length', async () => {
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
                      answer: 'Checked in [0].',
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
      const result = await generator.generateAnswer('Why?', 'owner', 'repo', multiEvidence);

      expect(result.evidenceStatus).toBe('insufficient');
      expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
      expect(result.sources).toEqual([]);
    });
  });
});
