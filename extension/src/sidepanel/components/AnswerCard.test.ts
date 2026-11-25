import { describe, it, expect } from 'vitest';
import { AskResponse } from '../../types';

describe('Answer and Sources Data Structure', () => {
  it('validates a supported answer payload with multiple source citations', () => {
    // TEST DATA ONLY - never used in production runtime
    const sampleResponse: AskResponse = {
      answer:
        'The auth token refresh was modified to prevent race conditions during concurrent API calls.',
      evidenceStatus: 'supported',
      sources: [
        {
          type: 'pull_request',
          title: 'Fix concurrent token refresh',
          url: 'https://github.com/example-owner/example-repo/pull/42',
          excerpt: 'Resolves race condition by locking refresh promise.',
        },
        {
          type: 'issue',
          title: 'Duplicate refresh requests fail under load',
          url: 'https://github.com/example-owner/example-repo/issues/40',
          excerpt: 'Users report 401 when multiple tabs load simultaneously.',
        },
      ],
    };

    expect(sampleResponse.evidenceStatus).toBe('supported');
    expect(sampleResponse.sources).toHaveLength(2);
    expect(sampleResponse.sources[0].type).toBe('pull_request');
    expect(sampleResponse.sources[0].url).toContain('https://github.com/');
    expect(sampleResponse.sources[1].type).toBe('issue');
  });

  it('validates an insufficient evidence response structure', () => {
    const insufficientResponse: AskResponse = {
      answer:
        'The available repository history does not provide enough evidence to determine why this change was made.',
      evidenceStatus: 'insufficient',
      sources: [],
    };

    expect(insufficientResponse.evidenceStatus).toBe('insufficient');
    expect(insufficientResponse.sources).toHaveLength(0);
    expect(insufficientResponse.answer).toMatch(/does not provide enough evidence/);
  });
});
