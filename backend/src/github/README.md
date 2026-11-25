# GitHub GraphQL Integration (Phase 2)

This module handles querying and normalizing public repository history from the GitHub GraphQL API.

## Implemented Components

- `queries.ts`: Verified GraphQL query fetching:
  - Pull requests (number, title, body, URL, state, createdAt, updatedAt, mergedAt, author)
  - Closing issues and their comments (`closingIssuesReferences`, `comments`)
  - PR reviews and inline review comments (`reviews`, `comments`)
  - Top-level PR discussion comments (`comments`)
  - PR associated commits (`commits` -> oid, message, url, committedDate)
- `normalize.ts`: Maps raw GraphQL response nodes into typed `NormalizedRecord` and `NormalizedRelationship` structures.
  - Generates deterministic IDs (`pr-123`, `issue-456`, `commit-abc1234`, `review-789`, `comment-999`).
  - Preserves exact source URLs and metadata.
  - Safe against missing/null fields and empty connections.
- `client.ts`: `GitHubGraphQLClient` using Node native `fetch`.
  - Rate limiting handling with reset timestamp diagnostics.
  - Typed error mapping (401 invalid/missing token, 404 repo not found, 429 rate limit, 503 network error, 504 timeout).
  - Explicit truncation tracking.

## Constants & Limits

Configured in `src/config.ts`:
- `MAX_PRS`: 20 pull requests
- `MAX_REVIEWS_PER_PR`: 5 reviews
- `MAX_COMMENTS_PER_PR`: 5 top-level discussion comments
- `MAX_REVIEW_COMMENTS_PER_REVIEW`: 5 comments per review
- `MAX_CLOSING_ISSUES_PER_PR`: 5 linked issues per PR
- `MAX_ISSUE_COMMENTS_PER_ISSUE`: 5 comments per issue
- `MAX_COMMITS_PER_PR`: 5 commits per PR
