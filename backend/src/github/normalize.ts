import { GITHUB_LIMITS } from '../config';
import {
  FetchHistoryResult,
  NormalizedRecord,
  NormalizedRelationship,
} from '../types';

export interface RawAuthor {
  login?: string | null;
}

export interface RawCommentNode {
  id?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  author?: RawAuthor | null;
}

export interface RawIssueNode {
  id?: string | null;
  number: number;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  author?: RawAuthor | null;
  comments?: {
    nodes?: RawCommentNode[] | null;
  } | null;
}

export interface RawReviewNode {
  id?: string | null;
  body?: string | null;
  state?: string | null;
  url?: string | null;
  createdAt?: string | null;
  author?: RawAuthor | null;
  comments?: {
    nodes?: RawCommentNode[] | null;
  } | null;
}

export interface RawCommitNode {
  commit?: {
    oid: string;
    message?: string | null;
    url?: string | null;
    committedDate?: string | null;
  } | null;
}

export interface RawPrNode {
  id?: string | null;
  number: number;
  title: string;
  body?: string | null;
  url: string;
  state?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  mergedAt?: string | null;
  author?: RawAuthor | null;
  closingIssuesReferences?: {
    nodes?: RawIssueNode[] | null;
  } | null;
  reviews?: {
    nodes?: RawReviewNode[] | null;
  } | null;
  comments?: {
    nodes?: RawCommentNode[] | null;
  } | null;
  commits?: {
    nodes?: RawCommitNode[] | null;
  } | null;
}

export interface RawRepositoryData {
  nameWithOwner?: string;
  isPrivate?: boolean;
  description?: string | null;
  pullRequests?: {
    totalCount?: number;
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    } | null;
    nodes?: (RawPrNode | null)[] | null;
  } | null;
}

/**
 * Normalizes raw GitHub GraphQL query results into structured records and relationships.
 * Safely handles missing/null connections, de-duplicates by unique ID, and notes truncation.
 */
export function normalizeRepositoryHistory(
  owner: string,
  repo: string,
  data: RawRepositoryData
): FetchHistoryResult {
  const recordsMap = new Map<string, NormalizedRecord>();
  const relationships: NormalizedRelationship[] = [];

  const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;

  const prNodes = (data.pullRequests?.nodes || []).filter(
    (n): n is RawPrNode => n !== null && typeof n === 'object' && typeof n.number === 'number'
  );

  const hasNextPage = Boolean(data.pullRequests?.pageInfo?.hasNextPage);
  const isTruncated = hasNextPage || prNodes.length >= GITHUB_LIMITS.MAX_PRS;

  for (const pr of prNodes) {
    const prId = `${repoKey}/pr-${pr.number}`;
    const prUrl = pr.url || `https://github.com/${owner}/${repo}/pull/${pr.number}`;
    const prTitle = `PR #${pr.number}: ${pr.title || 'Untitled PR'}`;
    const prBody = pr.body?.trim() || '';
    const prAuthor = pr.author?.login || null;

    if (!recordsMap.has(prId)) {
      recordsMap.set(prId, {
        id: prId,
        repoOwner: owner,
        repoName: repo,
        type: 'pull_request',
        githubId: String(pr.number),
        url: prUrl,
        title: prTitle,
        body: prBody,
        author: prAuthor,
        createdAt: pr.createdAt || new Date().toISOString(),
        updatedAt: pr.updatedAt || null,
      });
    }

    // 1. Linked Closing Issues
    const issueNodes = (pr.closingIssuesReferences?.nodes || []).filter(
      (i): i is RawIssueNode => i !== null && typeof i === 'object' && typeof i.number === 'number'
    );

    for (const issue of issueNodes) {
      const issueId = `${repoKey}/issue-${issue.number}`;
      const issueUrl = issue.url || `https://github.com/${owner}/${repo}/issues/${issue.number}`;
      const issueTitle = `Issue #${issue.number}: ${issue.title || 'Untitled Issue'}`;
      const issueBody = issue.body?.trim() || '';
      const issueAuthor = issue.author?.login || null;

      if (!recordsMap.has(issueId)) {
        recordsMap.set(issueId, {
          id: issueId,
          repoOwner: owner,
          repoName: repo,
          type: 'issue',
          githubId: String(issue.number),
          url: issueUrl,
          title: issueTitle,
          body: issueBody,
          author: issueAuthor,
          createdAt: issue.createdAt || pr.createdAt || new Date().toISOString(),
          updatedAt: issue.updatedAt || null,
        });
      }

      relationships.push({
        parentRecordId: prId,
        childRecordId: issueId,
        relationshipType: 'pr_issue',
      });

      // Issue Comments
      const issueComments = (issue.comments?.nodes || []).filter(
        (c): c is RawCommentNode => c !== null && typeof c === 'object'
      );
      for (const comment of issueComments) {
        if (!comment.body?.trim() && !comment.url) continue;
        const commentId = comment.id
          ? `${repoKey}/comment-${comment.id}`
          : `${repoKey}/comment-issue-${issue.number}-${comment.createdAt}`;
        const commentUrl = comment.url || issueUrl;

        if (!recordsMap.has(commentId)) {
          recordsMap.set(commentId, {
            id: commentId,
            repoOwner: owner,
            repoName: repo,
            type: 'comment',
            githubId: comment.id || commentId,
            url: commentUrl,
            title: `Comment on Issue #${issue.number}`,
            body: comment.body?.trim() || '',
            author: comment.author?.login || null,
            createdAt: comment.createdAt || issue.createdAt || new Date().toISOString(),
          });
        }

        relationships.push({
          parentRecordId: issueId,
          childRecordId: commentId,
          relationshipType: 'issue_comment',
        });
      }
    }

    // 2. PR Reviews and Review Comments
    const reviewNodes = (pr.reviews?.nodes || []).filter(
      (r): r is RawReviewNode => r !== null && typeof r === 'object'
    );

    for (const review of reviewNodes) {
      const reviewId = review.id
        ? `${repoKey}/review-${review.id}`
        : `${repoKey}/review-pr-${pr.number}-${review.createdAt}`;
      const reviewUrl = review.url || prUrl;
      const reviewState = review.state ? ` (${review.state})` : '';

      if (!recordsMap.has(reviewId)) {
        recordsMap.set(reviewId, {
          id: reviewId,
          repoOwner: owner,
          repoName: repo,
          type: 'review',
          githubId: review.id || reviewId,
          url: reviewUrl,
          title: `Review on PR #${pr.number}${reviewState}`,
          body: review.body?.trim() || '',
          author: review.author?.login || null,
          createdAt: review.createdAt || pr.createdAt || new Date().toISOString(),
        });
      }

      relationships.push({
        parentRecordId: prId,
        childRecordId: reviewId,
        relationshipType: 'pr_review',
      });

      // Review Comments
      const reviewComments = (review.comments?.nodes || []).filter(
        (c): c is RawCommentNode => c !== null && typeof c === 'object'
      );
      for (const comment of reviewComments) {
        if (!comment.body?.trim() && !comment.url) continue;
        const commentId = comment.id
          ? `${repoKey}/comment-${comment.id}`
          : `${repoKey}/review-comment-${review.id || pr.number}-${comment.createdAt}`;
        const commentUrl = comment.url || reviewUrl;

        if (!recordsMap.has(commentId)) {
          recordsMap.set(commentId, {
            id: commentId,
            repoOwner: owner,
            repoName: repo,
            type: 'comment',
            githubId: comment.id || commentId,
            url: commentUrl,
            title: `Review Comment on PR #${pr.number}`,
            body: comment.body?.trim() || '',
            author: comment.author?.login || null,
            createdAt: comment.createdAt || review.createdAt || new Date().toISOString(),
          });
        }

        relationships.push({
          parentRecordId: reviewId,
          childRecordId: commentId,
          relationshipType: 'review_comment',
        });
      }
    }

    // 3. Top-level PR Discussion Comments
    const prComments = (pr.comments?.nodes || []).filter(
      (c): c is RawCommentNode => c !== null && typeof c === 'object'
    );
    for (const comment of prComments) {
      if (!comment.body?.trim() && !comment.url) continue;
      const commentId = comment.id
        ? `${repoKey}/comment-${comment.id}`
        : `${repoKey}/pr-comment-${pr.number}-${comment.createdAt}`;
      const commentUrl = comment.url || prUrl;

      if (!recordsMap.has(commentId)) {
        recordsMap.set(commentId, {
          id: commentId,
          repoOwner: owner,
          repoName: repo,
          type: 'comment',
          githubId: comment.id || commentId,
          url: commentUrl,
          title: `Discussion Comment on PR #${pr.number}`,
          body: comment.body?.trim() || '',
          author: comment.author?.login || null,
          createdAt: comment.createdAt || pr.createdAt || new Date().toISOString(),
        });
      }

      relationships.push({
        parentRecordId: prId,
        childRecordId: commentId,
        relationshipType: 'pr_comment',
      });
    }

    // 4. PR Associated Commits
    const commitNodes = (pr.commits?.nodes || []).filter(
      (c): c is RawCommitNode => c !== null && typeof c === 'object' && Boolean(c.commit?.oid)
    );
    for (const commitNode of commitNodes) {
      const commit = commitNode.commit!;
      const shortOid = commit.oid.slice(0, 7);
      const commitId = `${repoKey}/commit-${commit.oid.slice(0, 12)}`;
      const commitUrl = commit.url || `https://github.com/${owner}/${repo}/commit/${commit.oid}`;
      const firstLine = (commit.message || '').split('\n')[0].trim();
      const commitTitle = `Commit ${shortOid}: ${firstLine || 'No commit message'}`;

      if (!recordsMap.has(commitId)) {
        recordsMap.set(commitId, {
          id: commitId,
          repoOwner: owner,
          repoName: repo,
          type: 'commit',
          githubId: commit.oid,
          url: commitUrl,
          title: commitTitle,
          body: commit.message?.trim() || '',
          author: null,
          createdAt: commit.committedDate || pr.createdAt || new Date().toISOString(),
        });
      }

      relationships.push({
        parentRecordId: prId,
        childRecordId: commitId,
        relationshipType: 'pr_commit',
      });
    }
  }

  return {
    records: Array.from(recordsMap.values()),
    relationships,
    prCount: prNodes.length,
    isTruncated,
    fetchedAt: new Date().toISOString(),
  };
}
