import { describe, expect, it } from 'vitest';
import { extractKeywords, summarize } from './keywords';

describe('extractKeywords', () => {
  it('promotes frequent topical words and filters stop words and numbers', () => {
    const text = `
      React components help structure React applications. Components can share state,
      render UI, and keep React code modular. The number 2026 should not become a
      keyword, and common words like the and with should be ignored.
    `;

    const keywords = extractKeywords(text, 5);

    expect(keywords).toContain('react');
    expect(keywords).toContain('components');
    expect(keywords).not.toContain('2026');
    expect(keywords).not.toContain('with');
  });
});

describe('summarize', () => {
  it('returns the leading sentences of a paragraph', () => {
    const text =
      'Synapse captures pages after meaningful reading time. It organizes them into a graph. It keeps data local.';

    expect(summarize(text, 2)).toBe(
      'Synapse captures pages after meaningful reading time. It organizes them into a graph.'
    );
  });
});
