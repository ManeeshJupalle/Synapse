import { describe, expect, it, vi } from 'vitest';
import type { CapturedPage } from '@shared/types';

vi.mock('@shared/embeddings', () => ({
  cosineSimilarity: (a: number[], b: number[]) =>
    a.reduce((sum, value, index) => sum + value * b[index], 0),
}));

import { AGGLOMERATIVE_MAX_PAGES, agglomerative, clusterColor, clusterLabel, clusterPages } from './cluster';

function makePage(id: number, embedding: number[], keywords: string[]): CapturedPage {
  return {
    id,
    url: `https://example.com/${id}`,
    urlHash: `hash-${id}`,
    title: `Page ${id}`,
    domain: 'example.com',
    excerpt: 'excerpt',
    content: 'content',
    wordCount: 300,
    capturedAt: id,
    lastVisitedAt: id,
    visitCount: 1,
    dwellMs: 15000,
    embedding,
    keywords,
    clusterId: null,
  };
}

describe('agglomerative', () => {
  it('merges similar pages above the threshold and excludes singletons', () => {
    const pages = [
      makePage(1, [1, 0], ['react', 'hooks']),
      makePage(2, [0.98, 0.02], ['react', 'state']),
      makePage(3, [0, 1], ['finance', 'budget']),
    ];

    const clusters = agglomerative(pages, 0.9);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].pageIds.sort((left, right) => left - right)).toEqual([1, 2]);
    expect(clusters[0].keywords).toContain('react');
  });
});

describe('clusterPages', () => {
  it('keeps pages beyond the agglomerative limit clustered instead of dropping them', () => {
    const groupA = Array.from({ length: AGGLOMERATIVE_MAX_PAGES / 2 + 10 }, (_, index) =>
      makePage(index + 1, [1, 0], ['react', 'hooks'])
    );
    const groupB = Array.from({ length: AGGLOMERATIVE_MAX_PAGES / 2 + 15 }, (_, index) =>
      makePage(groupA.length + index + 1, [0, 1], ['finance', 'budget'])
    );

    const clusters = clusterPages([...groupA, ...groupB], 0.9);
    const clusteredPageIds = new Set(clusters.flatMap((cluster) => cluster.pageIds));

    expect(clusters).toHaveLength(2);
    expect(clusteredPageIds.size).toBe(groupA.length + groupB.length);
    expect(clusters.map((cluster) => cluster.pageIds.length).sort((a, b) => a - b)).toEqual([
      groupA.length,
      groupB.length,
    ]);
  });
});

describe('cluster helpers', () => {
  it('cycles cluster colors through the palette', () => {
    expect(clusterColor(0)).toBe(clusterColor(10));
  });

  it('creates a readable label from the top keywords', () => {
    expect(clusterLabel(['react', 'hooks'])).toBe('React / Hooks');
  });
});
