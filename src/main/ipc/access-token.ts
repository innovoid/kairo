export function decodeJwtExpiry(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isExpiredAccessToken(accessToken: string, nowInSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = decodeJwtExpiry(accessToken);
  if (!exp) return false;
  return exp <= nowInSeconds;
}
