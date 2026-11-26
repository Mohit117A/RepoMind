import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './app';
import { config } from './config';
import { historyRetriever } from './retrieval/retriever';
import { geminiAnswerGenerator, INSUFFICIENT_EVIDENCE_SENTENCE } from './llm/generator';
import { ForbiddenError } from './lib/errors';

describe('Backend API Endpoints', () => {
  describe('Config and Security defaults', () => {
    it('defaults HOST to 127.0.0.1', () => {
      expect(config.host).toBe('127.0.0.1');
    });
  });

  describe('GET /health', () => {
    it('returns status ok with timestamp and HTTP 200', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/ask', () => {
    it('rejects an invalid owner with HTTP 400', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'invalid_owner!',
          repo: 'valid-repo',
          question: 'Why was this changed?',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error.message).toMatch(/owner/i);
    });

    it('rejects a too-short question with HTTP 400', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: 'react',
          question: 'ab',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error.message).toMatch(/question/i);
    });

    it('rejects unknown fields with HTTP 400', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: 'react',
          question: 'Why was this hook added?',
          extraField: 'not-allowed',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });

    it('rejects invalid repo name "." or ".." with HTTP 400', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: '..',
          question: 'Why was this hook added?',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });

    it('returns supported answer with grounded citations when evidence is found', async () => {
      vi.spyOn(historyRetriever, 'ingestRepository').mockResolvedValue({
        owner: 'facebook',
        repo: 'react',
        cached: true,
        isTruncated: false,
        counts: {
          pullRequests: 1,
          issues: 0,
          reviews: 0,
          comments: 0,
          commits: 0,
          totalRecords: 1,
          relationships: 0,
          chunks: 1,
          embeddings: 1,
        },
        fetchedAt: '2026-11-20T10:00:00Z',
      });

      vi.spyOn(historyRetriever, 'retrieveEvidence').mockResolvedValue({
        question: 'Why was fiber architecture introduced?',
        owner: 'facebook',
        repo: 'react',
        evidence: [
          {
            chunkId: 'chunk-1',
            recordId: 'facebook/react/pr-1',
            type: 'pull_request',
            title: 'PR #1: Fiber reconciler',
            url: 'https://github.com/facebook/react/pull/1',
            excerpt: 'Fiber enables incremental rendering and scheduling.',
            similarity: 0.9,
            timestamp: '2026-11-20T10:00:00Z',
          },
        ],
      });

      vi.spyOn(geminiAnswerGenerator, 'generateAnswer').mockResolvedValue({
        answer: 'Fiber enables incremental rendering to avoid blocking the main thread.',
        evidenceStatus: 'supported',
        sources: [
          {
            type: 'pull_request',
            title: 'PR #1: Fiber reconciler',
            url: 'https://github.com/facebook/react/pull/1',
            excerpt: 'Fiber enables incremental rendering and scheduling.',
          },
        ],
      });

      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: 'react',
          question: 'Why was fiber architecture introduced?',
        });

      expect(response.status).toBe(200);
      expect(response.body.evidenceStatus).toBe('supported');
      expect(response.body.answer).toBe(
        'Fiber enables incremental rendering to avoid blocking the main thread.'
      );
      expect(response.body.sources).toHaveLength(1);
      expect(response.body.sources[0].url).toBe('https://github.com/facebook/react/pull/1');
    });

    it('returns insufficient evidence when history does not support the question', async () => {
      vi.spyOn(historyRetriever, 'ingestRepository').mockResolvedValue({
        owner: 'facebook',
        repo: 'react',
        cached: true,
        isTruncated: false,
        counts: {
          pullRequests: 0,
          issues: 0,
          reviews: 0,
          comments: 0,
          commits: 0,
          totalRecords: 0,
          relationships: 0,
          chunks: 0,
          embeddings: 0,
        },
        fetchedAt: '2026-11-20T10:00:00Z',
      });

      vi.spyOn(historyRetriever, 'retrieveEvidence').mockResolvedValue({
        question: 'Why did React switch to Svelte?',
        owner: 'facebook',
        repo: 'react',
        evidence: [],
      });

      vi.spyOn(geminiAnswerGenerator, 'generateAnswer').mockResolvedValue({
        answer: INSUFFICIENT_EVIDENCE_SENTENCE,
        evidenceStatus: 'insufficient',
        sources: [],
      });

      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: 'react',
          question: 'Why did React switch to Svelte?',
        });

      expect(response.status).toBe(200);
      expect(response.body.evidenceStatus).toBe('insufficient');
      expect(response.body.answer).toBe(INSUFFICIENT_EVIDENCE_SENTENCE);
      expect(response.body.sources).toEqual([]);
    });

    it('waits for in-progress ingest instead of starting concurrent ingests for same repo', async () => {
      let resolveIngest: () => void = () => {};
      const slowIngest = new Promise<any>((resolve) => {
        resolveIngest = () =>
          resolve({
            owner: 'facebook',
            repo: 'react',
            cached: false,
            isTruncated: false,
            counts: {
              pullRequests: 1,
              issues: 0,
              reviews: 0,
              comments: 0,
              commits: 0,
              totalRecords: 1,
              relationships: 0,
              chunks: 1,
              embeddings: 1,
            },
            fetchedAt: '2026-11-20T10:00:00Z',
          });
      });

      const ingestSpy = vi.spyOn(historyRetriever, 'ingestRepository').mockImplementation(() => slowIngest);

      vi.spyOn(historyRetriever, 'retrieveEvidence').mockResolvedValue({
        question: 'Any query',
        owner: 'facebook',
        repo: 'react',
        evidence: [],
      });

      vi.spyOn(geminiAnswerGenerator, 'generateAnswer').mockResolvedValue({
        answer: INSUFFICIENT_EVIDENCE_SENTENCE,
        evidenceStatus: 'insufficient',
        sources: [],
      });

      // Fire two concurrent requests
      const req1 = request(app).post('/api/ask').send({
        owner: 'facebook',
        repo: 'react',
        question: 'Concurrent question 1?',
      });

      const req2 = request(app).post('/api/ask').send({
        owner: 'facebook',
        repo: 'react',
        question: 'Concurrent question 2?',
      });

      // Release the slow ingest after both requests have reached the handler
      setTimeout(() => {
        resolveIngest();
      }, 50);

      const [res1, res2] = await Promise.all([req1, req2]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Ingest was called only ONCE for both concurrent requests!
      expect(ingestSpy).toHaveBeenCalledTimes(1);
    });

    it('returns HTTP 403 with readable message when repository is private', async () => {
      vi.spyOn(historyRetriever, 'ingestRepository').mockRejectedValue(
        new ForbiddenError('Only public repositories are supported')
      );

      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'secret-org',
          repo: 'private-repo',
          question: 'Why was the secret key rotated?',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: {
          code: 'forbidden',
          message: 'Only public repositories are supported',
        },
      });
    });
  });

  describe('CORS and error handling', () => {
    it('handles unknown routes with HTTP 404', async () => {
      const response = await request(app).get('/unknown-endpoint');
      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });
});
