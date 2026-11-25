export interface RepoIdentifier {
  owner: string;
  repo: string;
}

const RESERVED_FIRST_SEGMENTS = new Set([
  'settings',
  'notifications',
  'marketplace',
  'explore',
  'topics',
  'orgs',
  'search',
  'login',
  'pulls',
  'issues',
  'sponsors',
  'features',
  'about',
  'new',
  'codespaces',
  'organizations',
]);

const OWNER_REGEX = /^[a-zA-Z0-9-]+$/;
const REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Parses a URL string and extracts GitHub repository owner and repo name.
 * Returns null if the URL is not a supported GitHub repository page.
 */
export function parseGithubUrl(urlString: string | undefined | null): RepoIdentifier | null {
  if (!urlString || typeof urlString !== 'string') {
    return null;
  }

  try {
    const url = new URL(urlString);

    // Only allow http: and https: protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Only allow github.com (or www.github.com)
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com') {
      return null;
    }

    // Split pathname into segments
    const segments = url.pathname
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Needs at least owner and repo
    if (segments.length < 2) {
      return null;
    }

    const [rawOwner, rawRepo] = segments;

    // Reject reserved GitHub top-level paths
    if (RESERVED_FIRST_SEGMENTS.has(rawOwner.toLowerCase())) {
      return null;
    }

    // Clean .git extension from repo name if present
    const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
    const owner = rawOwner;

    // Validate owner: 1-39 chars, alphanumeric + hyphen
    if (owner.length < 1 || owner.length > 39 || !OWNER_REGEX.test(owner)) {
      return null;
    }

    // Validate repo: 1-100 chars, alphanumeric + dot/underscore/hyphen, not "." or ".."
    if (
      repo.length < 1 ||
      repo.length > 100 ||
      repo === '.' ||
      repo === '..' ||
      !REPO_REGEX.test(repo)
    ) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}
