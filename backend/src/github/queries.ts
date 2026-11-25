import { GITHUB_LIMITS } from '../config';

/**
 * Bounded GitHub GraphQL query fetching pull requests and their related context:
 * - PR metadata (number, title, body, url, timestamps, state, author)
 * - Closing issues and their comments
 * - PR reviews and review comments
 * - Top-level PR discussion comments
 * - Associated commits
 */
export const REPOSITORY_HISTORY_QUERY = `
query GetRepoHistory(
  $owner: String!
  $repo: String!
  $maxPrs: Int!
  $maxClosingIssues: Int!
  $maxIssueComments: Int!
  $maxReviews: Int!
  $maxReviewComments: Int!
  $maxComments: Int!
  $maxCommits: Int!
) {
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    isPrivate
    description
    pullRequests(first: $maxPrs, orderBy: { field: CREATED_AT, direction: DESC }) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        number
        title
        body
        url
        state
        createdAt
        updatedAt
        mergedAt
        author {
          login
        }
        closingIssuesReferences(first: $maxClosingIssues) {
          nodes {
            id
            number
            title
            body
            url
            createdAt
            updatedAt
            author {
              login
            }
            comments(first: $maxIssueComments) {
              nodes {
                id
                body
                url
                createdAt
                author {
                  login
                }
              }
            }
          }
        }
        reviews(first: $maxReviews) {
          nodes {
            id
            body
            state
            url
            createdAt
            author {
              login
            }
            comments(first: $maxReviewComments) {
              nodes {
                id
                body
                url
                createdAt
                author {
                  login
                }
              }
            }
          }
        }
        comments(first: $maxComments) {
          nodes {
            id
            body
            url
            createdAt
            author {
              login
            }
          }
        }
        commits(first: $maxCommits) {
          nodes {
            commit {
              oid
              message
              url
              committedDate
            }
          }
        }
      }
    }
  }
}
`;

export function getRepositoryHistoryVariables(owner: string, repo: string) {
  return {
    owner,
    repo,
    maxPrs: GITHUB_LIMITS.MAX_PRS,
    maxClosingIssues: GITHUB_LIMITS.MAX_CLOSING_ISSUES_PER_PR,
    maxIssueComments: GITHUB_LIMITS.MAX_ISSUE_COMMENTS_PER_ISSUE,
    maxReviews: GITHUB_LIMITS.MAX_REVIEWS_PER_PR,
    maxReviewComments: GITHUB_LIMITS.MAX_REVIEW_COMMENTS_PER_REVIEW,
    maxComments: GITHUB_LIMITS.MAX_COMMENTS_PER_PR,
    maxCommits: GITHUB_LIMITS.MAX_COMMITS_PER_PR,
  };
}
