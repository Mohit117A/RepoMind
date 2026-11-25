import { config } from '../config';
import { AppError } from '../lib/errors';
import { FetchHistoryResult } from '../types';
import { REPOSITORY_HISTORY_QUERY, getRepositoryHistoryVariables } from './queries';
import { normalizeRepositoryHistory, RawRepositoryData } from './normalize';

export class GitHubApiError extends AppError {
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, code, message);
    this.name = 'GitHubApiError';
  }
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    type?: string;
    path?: (string | number)[];
  }>;
}

export class GitHubGraphQLClient {
  private readonly token: string | undefined;
  private readonly endpoint: string;

  constructor(token?: string, endpoint = 'https://api.github.com/graphql') {
    this.token = token !== undefined ? token : config.githubToken;
    this.endpoint = endpoint;
  }

  /**
   * Fetches repository history from GitHub GraphQL API, returning normalized records.
   */
  async fetchRepositoryHistory(
    owner: string,
    repo: string
  ): Promise<FetchHistoryResult> {
    if (!this.token) {
      throw new GitHubApiError(
        401,
        'missing_github_token',
        'GITHUB_TOKEN environment variable is required to fetch repository history. Please set GITHUB_TOKEN in your .env file.'
      );
    }

    const variables = getRepositoryHistoryVariables(owner, repo);
    let response: Response;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${this.token}`,
          'User-Agent': 'RepoMind-Backend',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: REPOSITORY_HISTORY_QUERY,
          variables,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new GitHubApiError(
          504,
          'github_timeout',
          'GitHub GraphQL API request timed out after 20 seconds.'
        );
      }
      const message = err instanceof Error ? err.message : 'Unknown network failure';
      throw new GitHubApiError(
        503,
        'github_network_error',
        `Failed to reach GitHub GraphQL API: ${message}`
      );
    }

    // Handle HTTP status codes
    if (response.status === 401) {
      throw new GitHubApiError(
        401,
        'invalid_github_token',
        'GitHub rejected the token (401 Unauthorized). Check your GITHUB_TOKEN in .env.'
      );
    }

    const remainingRateLimit = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    if (response.status === 403) {
      const resetInfo = rateLimitReset
        ? ` Rate limit resets at ${new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()}.`
        : '';
      throw new GitHubApiError(
        429,
        'rate_limited',
        `GitHub API rate limit exceeded or access forbidden (403).${resetInfo}`
      );
    }

    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        'github_api_error',
        `GitHub GraphQL API returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    let json: GraphQLResponse<{ repository: RawRepositoryData | null }>;
    try {
      json = (await response.json()) as GraphQLResponse<{ repository: RawRepositoryData | null }>;
    } catch {
      throw new GitHubApiError(
        502,
        'github_invalid_response',
        'GitHub GraphQL API returned invalid JSON.'
      );
    }

    // Check rate limit header even on 200
    if (remainingRateLimit === '0') {
      const resetInfo = rateLimitReset
        ? ` Rate limit resets at ${new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()}.`
        : '';
      throw new GitHubApiError(
        429,
        'rate_limited',
        `GitHub API rate limit reached (0 remaining).${resetInfo}`
      );
    }

    // Handle GraphQL-level errors
    if (json.errors && json.errors.length > 0) {
      const isNotFound = json.errors.some(
        (e) => e.type === 'NOT_FOUND' || e.message.toLowerCase().includes('could not resolve to a repository')
      );
      if (isNotFound) {
        throw new GitHubApiError(
          404,
          'repo_not_found',
          `Repository "${owner}/${repo}" was not found or is inaccessible. Ensure it exists and is public.`
        );
      }

      // If repository data is missing, we must fail
      if (!json.data?.repository) {
        const errorMessages = json.errors.map((e) => e.message).join('; ');
        throw new GitHubApiError(
          500,
          'github_graphql_error',
          `GitHub GraphQL query failed: ${errorMessages}`
        );
      }
    }

    if (!json.data?.repository) {
      throw new GitHubApiError(
        404,
        'repo_not_found',
        `Repository "${owner}/${repo}" was not found or is inaccessible.`
      );
    }

    return normalizeRepositoryHistory(owner, repo, json.data.repository);
  }
}

export const githubClient = new GitHubGraphQLClient();
