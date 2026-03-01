import { describe, expect, it } from 'vitest';
import { decodeJwtExpiry, isExpiredAccessToken } from '../access-token';

function makeToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('access-token helpers', () => {
  it('decodes exp from valid jwt payload', () => {
    const token = makeToken({ sub: 'u1', exp: 1_900_000_000 });
    expect(decodeJwtExpiry(token)).toBe(1_900_000_000);
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtExpiry('bad-token')).toBeNull();
    expect(decodeJwtExpiry('a.b.c')).toBeNull();
  });

  it('flags expired tokens against provided now value', () => {
    const token = makeToken({ exp: 100 });
    expect(isExpiredAccessToken(token, 101)).toBe(true);
    expect(isExpiredAccessToken(token, 99)).toBe(false);
  });

  it('treats tokens without exp as non-expired', () => {
    const token = makeToken({ sub: 'u2' });
    expect(isExpiredAccessToken(token, 1_000_000)).toBe(false);
  });
});
