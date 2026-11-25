import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app';

describe('Backend API Endpoints', () => {
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

    it('returns honest HTTP 501 not_implemented for a valid request (not a fake answer)', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({
          owner: 'facebook',
          repo: 'react',
          question: 'Why was fiber architecture introduced?',
        });

      expect(response.status).toBe(501);
      expect(response.body).toEqual({
        error: {
          code: 'not_implemented',
          message:
            'Repository history retrieval and AI answering are not implemented yet.',
        },
      });
      // Ensure it NEVER returns fake answer or citations
      expect(response.body.answer).toBeUndefined();
      expect(response.body.sources).toBeUndefined();
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
