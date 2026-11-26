import { RepoIdentifier } from '../lib/parseGithubUrl';

export interface GuardedState {
  currentRepo: RepoIdentifier | null;
  activeRequestId: number;
}

/**
 * Compares two repository identifiers case-insensitively.
 * Moving between pages of the same repository (or casing variants) returns true.
 */
export function isSameRepo(
  a: RepoIdentifier | null | undefined,
  b: RepoIdentifier | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.repo.toLowerCase() === b.repo.toLowerCase()
  );
}

/**
 * Manages active in-flight requests, abort controllers, and stale completion checks.
 */
export class RequestGuard {
  private currentRepo: RepoIdentifier | null = null;
  private nextRequestId: number = 1;
  private activeRequestId: number = 0;
  private abortController: AbortController | null = null;

  /**
   * Called when active repository changes in the UI.
   * If the repository changed (case-insensitive), aborts any in-flight request,
   * invalidates the active request ID, and returns true.
   * If same repository, returns false (does not cancel in-flight request).
   */
  public onRepoChange(newRepo: RepoIdentifier | null): boolean {
    if (isSameRepo(this.currentRepo, newRepo)) {
      // Same repository, do not cancel or reset
      return false;
    }

    this.currentRepo = newRepo;
    this.abort();
    this.activeRequestId = 0;
    return true;
  }

  /**
   * Starts a new request for the given repository.
   * Aborts any prior in-flight request, increments request ID,
   * and returns an object containing the new requestId and abort signal.
   */
  public startRequest(repo: RepoIdentifier): {
    requestId: number;
    signal: AbortSignal;
  } {
    this.abort();
    this.currentRepo = repo;
    const requestId = this.nextRequestId++;
    this.activeRequestId = requestId;
    this.abortController = new AbortController();

    return {
      requestId,
      signal: this.abortController.signal,
    };
  }

  /**
   * Checks whether a completed response or error belongs to the currently active request
   * AND the currently active repository.
   */
  public isCurrent(requestId: number, repo: RepoIdentifier | null): boolean {
    if (requestId === 0 || requestId !== this.activeRequestId) {
      return false;
    }
    return isSameRepo(this.currentRepo, repo);
  }

  /**
   * Cleans up the active request if it matches the current request ID.
   */
  public finishRequest(requestId: number): void {
    if (this.activeRequestId === requestId) {
      this.abortController = null;
    }
  }

  /**
   * Aborts the active controller if present.
   */
  public abort(): void {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.abortController = null;
    }
  }

  public getCurrentRepo(): RepoIdentifier | null {
    return this.currentRepo;
  }

  public getActiveRequestId(): number {
    return this.activeRequestId;
  }
}
