import { describe, it, expect } from 'vitest';
import { resolveCacheTtlMs } from './config';

describe('resolveCacheTtlMs', () => {
  it('defaults to 24 hours when unset', () => {
    expect(resolveCacheTtlMs(undefined)).toBe(24 * 60 * 60 * 1000);
  });

  it('defaults to 24 hours when blank', () => {
    expect(resolveCacheTtlMs('')).toBe(24 * 60 * 60 * 1000);
    expect(resolveCacheTtlMs('   ')).toBe(24 * 60 * 60 * 1000);
  });

  it('resolves positive number in hours to milliseconds (e.g. "168")', () => {
    expect(resolveCacheTtlMs('168')).toBe(168 * 60 * 60 * 1000);
  });

  it('throws "CACHE_TTL_HOURS must be a positive number" for "0"', () => {
    expect(() => resolveCacheTtlMs('0')).toThrow(
      'CACHE_TTL_HOURS must be a positive number'
    );
  });

  it('throws "CACHE_TTL_HOURS must be a positive number" for "-1"', () => {
    expect(() => resolveCacheTtlMs('-1')).toThrow(
      'CACHE_TTL_HOURS must be a positive number'
    );
  });

  it('throws "CACHE_TTL_HOURS must be a positive number" for non-numeric "abc"', () => {
    expect(() => resolveCacheTtlMs('abc')).toThrow(
      'CACHE_TTL_HOURS must be a positive number'
    );
  });
});
