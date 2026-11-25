import { describe, it, expect } from 'vitest';
import { normalizeRepositoryHistory, RawRepositoryData } from './normalize';

describe('normalizeRepositoryHistory', () => {
  it('normalizes a full PR with issues, reviews, comments, and commits', () => {
    const rawData: RawRepositoryData = {
      nameWithOwner: 'fastify/fastify',
      pullRequests: {
        totalCount: 1,
        pageInfo: { hasNextPage: false },
        nodes: [
          {
            id: 'PR_1',
            number: 100,
            title: 'Fix route validation',
            body: 'Fixes schema validation bug',
            url: 'https://github.com/fastify/fastify/pull/100',
            state: 'MERGED',
            createdAt: '2026-11-20T10:00:00Z',
            updatedAt: '2026-11-20T12:00:00Z',
            mergedAt: '2026-11-20T12:00:00Z',
            author: { login: 'alice' },
            closingIssuesReferences: {
              nodes: [
                {
                  id: 'ISSUE_50',
                  number: 50,
                  title: 'Schema crashes on null input',
                  body: 'Detailed issue description',
                  url: 'https://github.com/fastify/fastify/issues/50',
                  createdAt: '2026-11-19T08:00:00Z',
                  author: { login: 'bob' },
                  comments: {
                    nodes: [
                      {
                        id: 'IC_1',
                        body: 'I reproduced this bug',
                        url: 'https://github.com/fastify/fastify/issues/50#issuecomment-1',
                        createdAt: '2026-11-19T09:00:00Z',
                        author: { login: 'charlie' },
                      },
                    ],
                  },
                },
              ],
            },
            reviews: {
              nodes: [
                {
                  id: 'REV_1',
                  body: 'Looks good to me',
                  state: 'APPROVED',
                  url: 'https://github.com/fastify/fastify/pull/100#pullrequestreview-1',
                  createdAt: '2026-11-20T11:00:00Z',
                  author: { login: 'reviewer1' },
                  comments: {
                    nodes: [
                      {
                        id: 'RC_1',
                        body: 'Consider adding a null check here',
                        url: 'https://github.com/fastify/fastify/pull/100#discussion_r1',
                        createdAt: '2026-11-20T11:15:00Z',
                        author: { login: 'reviewer1' },
                      },
                    ],
                  },
                },
              ],
            },
            comments: {
              nodes: [
                {
                  id: 'PC_1',
                  body: 'CI is passing now',
                  url: 'https://github.com/fastify/fastify/pull/100#issuecomment-2',
                  createdAt: '2026-11-20T11:30:00Z',
                  author: { login: 'alice' },
                },
              ],
            },
            commits: {
              nodes: [
                {
                  commit: {
                    oid: 'abcdef1234567890',
                    message: 'fix: check schema null property\n\nMore details',
                    url: 'https://github.com/fastify/fastify/commit/abcdef1234567890',
                    committedDate: '2026-11-20T10:30:00Z',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const result = normalizeRepositoryHistory('fastify', 'fastify', rawData);

    expect(result.prCount).toBe(1);
    expect(result.isTruncated).toBe(false);
    expect(result.records).toHaveLength(7); // PR, Issue, IssueComment, Review, ReviewComment, PRComment, Commit

    const prRecord = result.records.find((r) => r.type === 'pull_request');
    expect(prRecord).toBeDefined();
    expect(prRecord?.title).toBe('PR #100: Fix route validation');
    expect(prRecord?.author).toBe('alice');

    const issueRecord = result.records.find((r) => r.type === 'issue');
    expect(issueRecord?.title).toBe('Issue #50: Schema crashes on null input');
    expect(issueRecord?.author).toBe('bob');

    const commitRecord = result.records.find((r) => r.type === 'commit');
    expect(commitRecord?.title).toContain('Commit abcdef1: fix: check schema null property');

    // Verify relationships
    expect(result.relationships).toContainEqual({
      parentRecordId: 'pr-100',
      childRecordId: 'issue-50',
      relationshipType: 'pr_issue',
    });
    expect(result.relationships).toContainEqual({
      parentRecordId: 'pr-100',
      childRecordId: 'commit-abcdef123456',
      relationshipType: 'pr_commit',
    });
  });

  it('safely handles PRs with null/empty reviews, comments, and issues', () => {
    const rawData: RawRepositoryData = {
      nameWithOwner: 'fastify/fastify',
      pullRequests: {
        nodes: [
          {
            number: 101,
            title: 'Empty PR',
            body: null,
            url: 'https://github.com/fastify/fastify/pull/101',
            createdAt: '2026-11-21T10:00:00Z',
            author: null,
            closingIssuesReferences: null,
            reviews: { nodes: null },
            comments: { nodes: [] },
            commits: null,
          },
        ],
      },
    };

    const result = normalizeRepositoryHistory('fastify', 'fastify', rawData);
    expect(result.prCount).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].body).toBe('');
    expect(result.records[0].author).toBeNull();
    expect(result.relationships).toHaveLength(0);
  });

  it('marks isTruncated as true when hasNextPage is true', () => {
    const rawData: RawRepositoryData = {
      nameWithOwner: 'fastify/fastify',
      pullRequests: {
        pageInfo: { hasNextPage: true },
        nodes: [
          {
            number: 1,
            title: 'PR 1',
            url: 'https://github.com/fastify/fastify/pull/1',
            createdAt: '2026-11-21T10:00:00Z',
          },
        ],
      },
    };

    const result = normalizeRepositoryHistory('fastify', 'fastify', rawData);
    expect(result.isTruncated).toBe(true);
  });
});
