import { describe, it, expect } from 'vitest';
import { parseGithubUrl } from './parseGithubUrl';

describe('parseGithubUrl', () => {
  it('parses standard repository root URLs', () => {
    expect(parseGithubUrl('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses repository URLs with trailing slashes', () => {
    expect(parseGithubUrl('https://github.com/facebook/react/')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses repository URLs with query parameters and hash fragments', () => {
    expect(
      parseGithubUrl('https://github.com/facebook/react?tab=readme-ov-file#readme')
    ).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses pull request URLs', () => {
    expect(
      parseGithubUrl('https://github.com/facebook/react/pull/28000')
    ).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(
      parseGithubUrl('https://github.com/facebook/react/pull/28000/files')
    ).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses issue URLs', () => {
    expect(
      parseGithubUrl('https://github.com/facebook/react/issues/1234')
    ).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses commit URLs', () => {
    expect(
      parseGithubUrl(
        'https://github.com/facebook/react/commit/d98612c62c3e414c1d764cf6e76cfb'
      )
    ).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('strips .git extension from repository name', () => {
    expect(parseGithubUrl('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('supports www.github.com', () => {
    expect(parseGithubUrl('https://www.github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('rejects GitHub homepage and top-level pages', () => {
    expect(parseGithubUrl('https://github.com')).toBeNull();
    expect(parseGithubUrl('https://github.com/')).toBeNull();
  });

  it('rejects reserved GitHub first segments', () => {
    expect(parseGithubUrl('https://github.com/settings/profile')).toBeNull();
    expect(parseGithubUrl('https://github.com/notifications')).toBeNull();
    expect(parseGithubUrl('https://github.com/marketplace')).toBeNull();
    expect(parseGithubUrl('https://github.com/explore')).toBeNull();
    expect(parseGithubUrl('https://github.com/orgs/facebook/people')).toBeNull();
    expect(parseGithubUrl('https://github.com/pulls')).toBeNull();
    expect(parseGithubUrl('https://github.com/issues')).toBeNull();
    expect(parseGithubUrl('https://github.com/features')).toBeNull();
  });

  it('rejects non-GitHub domains', () => {
    expect(parseGithubUrl('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGithubUrl('https://google.com')).toBeNull();
  });

  it('rejects invalid inputs such as null, undefined, empty strings and non-URLs', () => {
    expect(parseGithubUrl(null)).toBeNull();
    expect(parseGithubUrl(undefined)).toBeNull();
    expect(parseGithubUrl('')).toBeNull();
    expect(parseGithubUrl('not a url')).toBeNull();
    expect(parseGithubUrl('ftp://github.com/facebook/react')).toBeNull();
  });

  it('rejects repo names with "." or ".."', () => {
    expect(parseGithubUrl('https://github.com/facebook/.')).toBeNull();
    expect(parseGithubUrl('https://github.com/facebook/..')).toBeNull();
  });
});
