import { describe, it, expect } from 'vitest';
import { RequestGuard, RepoAnswerCache, isSameRepo } from './requestGuard';
import { resolveTabUrl } from './hooks/useActiveRepo';
import { RepoIdentifier } from '../lib/parseGithubUrl';
import { AskResponse } from '../types';

describe('resolveTabUrl', () => {
  it('prefers url when present', () => {
    expect(resolveTabUrl({ url: 'https://github.com/fastify/fastify/pull/1', pendingUrl: 'https://github.com/fastify/fastify' })).toBe(
      'https://github.com/fastify/fastify/pull/1'
    );
  });

  it('falls back to pendingUrl when url is empty or undefined', () => {
    expect(resolveTabUrl({ url: '', pendingUrl: 'https://github.com/fastify/fastify/pull/2' })).toBe(
      'https://github.com/fastify/fastify/pull/2'
    );
    expect(resolveTabUrl({ pendingUrl: 'https://github.com/fastify/fastify/pull/2' })).toBe(
      'https://github.com/fastify/fastify/pull/2'
    );
  });

  it('returns null when neither url nor pendingUrl is present', () => {
    expect(resolveTabUrl({})).toBeNull();
    expect(resolveTabUrl(undefined)).toBeNull();
  });
});

describe('RepoAnswerCache', () => {
  const dummyAnswer: AskResponse = {
    answer: 'Fastify ecosystem update.',
    evidenceStatus: 'supported',
    sources: [
      {
        type: 'pull_request',
        title: 'PR #7259',
        url: 'https://github.com/fastify/fastify/pull/7259',
        excerpt: 'docs: remove deprecated plugin',
      },
    ],
  };

  it('stores and retrieves answer for repository case-insensitively', () => {
    const cache = new RepoAnswerCache();
    const repoA: RepoIdentifier = { owner: 'fastify', repo: 'fastify' };
    const repoAUpper: RepoIdentifier = { owner: 'FASTIFY', repo: 'FASTIFY' };

    cache.set(repoA, dummyAnswer);
    expect(cache.get(repoAUpper)).toEqual(dummyAnswer);
  });

  it('hides answer when switching to other repo or non-github page, and restores when switching back', () => {
    const cache = new RepoAnswerCache();
    const repoA: RepoIdentifier = { owner: 'fastify', repo: 'fastify' };
    const repoB: RepoIdentifier = { owner: 'facebook', repo: 'react' };

    cache.set(repoA, dummyAnswer);

    // Switching to repo B: repo B has no cached answer
    expect(cache.get(repoB)).toBeNull();

    // Switching to non-GitHub page: null has no cached answer
    expect(cache.get(null)).toBeNull();

    // Switching back to repo A: answer is shown again!
    expect(cache.get(repoA)).toEqual(dummyAnswer);
  });

  it('new question replaces cached answer for repo', () => {
    const cache = new RepoAnswerCache();
    const repoA: RepoIdentifier = { owner: 'fastify', repo: 'fastify' };
    const newAnswer: AskResponse = {
      answer: 'New schema answer',
      evidenceStatus: 'supported',
      sources: [],
    };

    cache.set(repoA, dummyAnswer);
    expect(cache.get(repoA)).toEqual(dummyAnswer);

    cache.set(repoA, newAnswer);
    expect(cache.get(repoA)).toEqual(newAnswer);
  });
});

describe('isSameRepo', () => {
  it('returns true for same repo case-insensitively', () => {
    const a: RepoIdentifier = { owner: 'Fastify', repo: 'Fastify' };
    const b: RepoIdentifier = { owner: 'fastify', repo: 'fastify' };
    expect(isSameRepo(a, b)).toBe(true);
  });

  it('returns false for different owners or repos', () => {
    const a: RepoIdentifier = { owner: 'facebook', repo: 'react' };
    const b: RepoIdentifier = { owner: 'vuejs', repo: 'core' };
    expect(isSameRepo(a, b)).toBe(false);
  });

  it('handles nulls correctly', () => {
    expect(isSameRepo(null, null)).toBe(true);
    expect(isSameRepo({ owner: 'a', repo: 'b' }, null)).toBe(false);
    expect(isSameRepo(null, { owner: 'a', repo: 'b' })).toBe(false);
  });
});

describe('RequestGuard', () => {
  it('does not cancel in-flight request when moving between pages of the same repository', () => {
    const guard = new RequestGuard();
    const repoA: RepoIdentifier = { owner: 'facebook', repo: 'react' };
    const sameRepoPage: RepoIdentifier = { owner: 'FACEBOOK', repo: 'REACT' };

    const { requestId, signal } = guard.startRequest(repoA);
    expect(signal.aborted).toBe(false);

    // Navigating between pages of the same repo (case-insensitively)
    const changed = guard.onRepoChange(sameRepoPage);
    expect(changed).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(guard.isCurrent(requestId, sameRepoPage)).toBe(true);
  });

  it('aborts old request and marks late success as stale when repo changes', () => {
    const guard = new RequestGuard();
    const repoA: RepoIdentifier = { owner: 'facebook', repo: 'react' };
    const repoB: RepoIdentifier = { owner: 'vuejs', repo: 'core' };

    const { requestId: reqA, signal: signalA } = guard.startRequest(repoA);
    expect(signalA.aborted).toBe(false);

    // User switches to Repo B while Request A is in-flight
    const changed = guard.onRepoChange(repoB);
    expect(changed).toBe(true);
    expect(signalA.aborted).toBe(true);

    // Late success from Request A arrives
    expect(guard.isCurrent(reqA, repoB)).toBe(false);
    expect(guard.isCurrent(reqA, repoA)).toBe(false);
  });

  it('aborts old request and marks late error as stale when repo changes', () => {
    const guard = new RequestGuard();
    const repoA: RepoIdentifier = { owner: 'facebook', repo: 'react' };
    const repoB: RepoIdentifier = { owner: 'vuejs', repo: 'core' };

    const { requestId: reqA, signal: signalA } = guard.startRequest(repoA);

    // Switched to repo B
    guard.onRepoChange(repoB);
    expect(signalA.aborted).toBe(true);

    // Late error from request A arrives
    expect(guard.isCurrent(reqA, repoB)).toBe(false);
  });

  it('ignores the first request after switching A -> B -> A', () => {
    const guard = new RequestGuard();
    const repoA: RepoIdentifier = { owner: 'facebook', repo: 'react' };
    const repoB: RepoIdentifier = { owner: 'vuejs', repo: 'core' };

    // 1. Request 1 on Repo A
    const { requestId: reqA1, signal: signalA1 } = guard.startRequest(repoA);

    // 2. Switch to Repo B
    guard.onRepoChange(repoB);
    expect(signalA1.aborted).toBe(true);

    // 3. Switch back to Repo A and start Request 2
    guard.onRepoChange(repoA);
    const { requestId: reqA2 } = guard.startRequest(repoA);
    expect(reqA2).toBeGreaterThan(reqA1);

    // Late response from the first request (reqA1) arrives now that we are back on Repo A
    expect(guard.isCurrent(reqA1, repoA)).toBe(false);

    // But Request 2 is valid and current
    expect(guard.isCurrent(reqA2, repoA)).toBe(true);
  });
});
