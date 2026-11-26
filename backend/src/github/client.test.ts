import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubGraphQLClient, GitHubApiError } from './client';

describe('GitHubGraphQLClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws 401 missing_github_token if no token provided', async () => {
    const client = new GitHubGraphQLClient('', 'https://api.github.com/graphql');
    await expect(client.fetchRepositoryHistory('owner', 'repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 401,
        code: 'missing_github_token',
      })
    );
  });

  it('handles 401 invalid_github_token from GitHub', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      statusText: 'Unauthorized',
      headers: new Headers(),
    });

    const client = new GitHubGraphQLClient('invalid-token');
    await expect(client.fetchRepositoryHistory('owner', 'repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 401,
        code: 'invalid_github_token',
      })
    );
  });

  it('handles 403 rate_limited with reset time', async () => {
    const headers = new Headers();
    headers.set('x-ratelimit-remaining', '0');
    headers.set('x-ratelimit-reset', '1700000000');

    global.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      statusText: 'Forbidden',
      headers,
    });

    const client = new GitHubGraphQLClient('valid-token');
    await expect(client.fetchRepositoryHistory('owner', 'repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 429,
        code: 'rate_limited',
      })
    );
  });

  it('handles 404 repo_not_found when repository is null in GraphQL response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: { repository: null },
        errors: [{ message: 'Could not resolve to a Repository with the name owner/repo' }],
      }),
    });

    const client = new GitHubGraphQLClient('valid-token');
    await expect(client.fetchRepositoryHistory('owner', 'repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 404,
        code: 'repo_not_found',
      })
    );
  });

  it('handles network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    const client = new GitHubGraphQLClient('valid-token');
    await expect(client.fetchRepositoryHistory('owner', 'repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 503,
        code: 'github_network_error',
      })
    );
  });

  it('rejects repository when isPrivate is true with 403 Forbidden', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: {
          repository: {
            nameWithOwner: 'owner/secret-repo',
            isPrivate: true,
            pullRequests: { totalCount: 0, nodes: [] },
          },
        },
      }),
    });

    const client = new GitHubGraphQLClient('valid-token');
    await expect(client.fetchRepositoryHistory('owner', 'secret-repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 403,
        message: 'Only public repositories are supported',
      })
    );
  });

  it('rejects repository when isPrivate is missing/undefined with 403 Forbidden', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: {
          repository: {
            nameWithOwner: 'owner/unknown-visibility-repo',
            // isPrivate omitted
            pullRequests: { totalCount: 0, nodes: [] },
          },
        },
      }),
    });

    const client = new GitHubGraphQLClient('valid-token');
    await expect(client.fetchRepositoryHistory('owner', 'unknown-visibility-repo')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 403,
        message: 'Only public repositories are supported',
      })
    );
  });

  it('accepts repository when isPrivate is false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: {
          repository: {
            nameWithOwner: 'owner/public-repo',
            isPrivate: false,
            pullRequests: { totalCount: 0, nodes: [] },
          },
        },
      }),
    });

    const client = new GitHubGraphQLClient('valid-token');
    const result = await client.fetchRepositoryHistory('owner', 'public-repo');
    expect(result.records).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });
});
