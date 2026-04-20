import { describe, expect, it } from 'vitest';
import { domainOf, fnv1a, hashUrl } from './hash';

describe('hashUrl', () => {
  it('strips tracking parameters and fragments before hashing', () => {
    const original =
      'https://example.com/article?utm_source=newsletter&utm_medium=email&ref=feed&id=42#section';
    const normalized = 'https://example.com/article?id=42';

    expect(hashUrl(original)).toBe(hashUrl(normalized));
  });

  it('keeps meaningful query parameters in the hash', () => {
    expect(hashUrl('https://example.com/article?id=42')).not.toBe(
      hashUrl('https://example.com/article?id=99')
    );
  });

  it('falls back to hashing the raw string when the URL is invalid', () => {
    expect(hashUrl('not a valid url')).toBe(fnv1a('not a valid url'));
  });
});

describe('domainOf', () => {
  it('normalizes away the www subdomain', () => {
    expect(domainOf('https://www.example.com/docs')).toBe('example.com');
  });

  it('returns unknown for malformed values', () => {
    expect(domainOf('%%%')).toBe('unknown');
  });
});
