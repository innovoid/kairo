import { describe, expect, it } from 'vitest';
import { sanitizeReleaseNotesHtml } from '../release-notes';

describe('sanitizeReleaseNotesHtml', () => {
  it('removes unsafe tags and attributes', () => {
    const raw = `
      <p>Hello</p>
      <img src=x onerror=alert(1)>
      <script>alert('xss')</script>
      <a href="javascript:alert('xss')" onclick="alert(1)">bad link</a>
      <a href="https://example.com" style="color:red">good link</a>
    `;

    const sanitized = sanitizeReleaseNotesHtml(raw);
    expect(sanitized).toContain('<p>Hello</p>');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).toContain('rel="noopener noreferrer nofollow"');
  });

  it('returns empty string for nullish input', () => {
    expect(sanitizeReleaseNotesHtml(null)).toBe('');
    expect(sanitizeReleaseNotesHtml(undefined)).toBe('');
  });
});

