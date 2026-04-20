import { cosineSimilarity } from '@shared/embeddings';
import type { CapturedPage } from '@shared/types';

export interface ClusterResult {
  pageIds: number[];
  centroid: number[];
  keywords: string[];
}

export const AGGLOMERATIVE_MAX_PAGES = 200;

function normalizeVector(vector: number[]): number[] {
  if (vector.length === 0) return [];

  let norm = 0;
  for (let index = 0; index < vector.length; index++) {
    norm += vector[index] * vector[index];
  }

  norm = Math.sqrt(norm) || 1;
  return vector.map((value) => value / norm);
}

function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  const dimension = vectors[0].length;
  const out = new Array(dimension).fill(0);

  for (const vector of vectors) {
    for (let index = 0; index < dimension; index++) {
      out[index] += vector[index];
    }
  }

  for (let index = 0; index < dimension; index++) {
    out[index] /= vectors.length;
  }

  return normalizeVector(out);
}

/**
 * Simple agglomerative clustering: each page starts as its own cluster and the
 * two closest clusters are repeatedly merged while their similarity stays above
 * the configured threshold.
 */
export function agglomerative(pages: CapturedPage[], threshold: number): ClusterResult[] {
  const usable = pages.filter((page) => page.id != null && page.embedding?.length);
  if (usable.length === 0) return [];

  type AgglomerativeCluster = {
    ids: number[];
    centroid: number[];
    vectors: number[][];
    keywords: string[];
  };

  let clusters: AgglomerativeCluster[] = usable.map((page) => ({
    ids: [page.id as number],
    centroid: page.embedding,
    vectors: [page.embedding],
    keywords: page.keywords.slice(0, 4),
  }));

  while (true) {
    let bestLeft = -1;
    let bestRight = -1;
    let bestSimilarity = threshold;

    for (let left = 0; left < clusters.length; left++) {
      for (let right = left + 1; right < clusters.length; right++) {
        const similarity = cosineSimilarity(clusters[left].centroid, clusters[right].centroid);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    if (bestLeft === -1) break;

    const leftCluster = clusters[bestLeft];
    const rightCluster = clusters[bestRight];
    const mergedVectors = [...leftCluster.vectors, ...rightCluster.vectors];
    const mergedCluster: AgglomerativeCluster = {
      ids: [...leftCluster.ids, ...rightCluster.ids],
      vectors: mergedVectors,
      centroid: meanVector(mergedVectors),
      keywords: mergeKeywords(leftCluster.keywords, rightCluster.keywords),
    };

    clusters = clusters.filter((_, index) => index !== bestLeft && index !== bestRight);
    clusters.push(mergedCluster);
  }

  return clusters
    .filter((cluster) => cluster.ids.length >= 2)
    .map((cluster) => ({
      pageIds: cluster.ids,
      centroid: cluster.centroid,
      keywords: cluster.keywords.slice(0, 5),
    }));
}

type IncrementalCluster = {
  ids: number[];
  centroid: number[];
  sum: number[];
  keywordCounts: Map<string, number>;
};

function countKeywords(keywords: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const keyword of keywords) {
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }
  return counts;
}

function createCluster(page: CapturedPage): IncrementalCluster {
  return {
    ids: [page.id as number],
    centroid: [...page.embedding],
    sum: [...page.embedding],
    keywordCounts: countKeywords(page.keywords),
  };
}

function addPageToCluster(cluster: IncrementalCluster, page: CapturedPage): void {
  cluster.ids.push(page.id as number);

  for (let index = 0; index < cluster.sum.length; index++) {
    cluster.sum[index] += page.embedding[index];
  }

  cluster.centroid = normalizeVector([...cluster.sum]);

  for (const keyword of page.keywords) {
    cluster.keywordCounts.set(keyword, (cluster.keywordCounts.get(keyword) ?? 0) + 1);
  }
}

function topKeywords(counts: Map<string, number>, limit = 5): string[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function incremental(pages: CapturedPage[], threshold: number): ClusterResult[] {
  const usable = pages
    .filter((page) => page.id != null && page.embedding?.length)
    .sort((left, right) => left.capturedAt - right.capturedAt);
  const clusters: IncrementalCluster[] = [];

  for (const page of usable) {
    let bestCluster: IncrementalCluster | undefined;
    let bestSimilarity = threshold;

    for (const cluster of clusters) {
      const similarity = cosineSimilarity(page.embedding, cluster.centroid);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      addPageToCluster(bestCluster, page);
    } else {
      clusters.push(createCluster(page));
    }
  }

  return clusters
    .filter((cluster) => cluster.ids.length >= 2)
    .map((cluster) => ({
      pageIds: cluster.ids,
      centroid: cluster.centroid,
      keywords: topKeywords(cluster.keywordCounts),
    }));
}

export function clusterPages(pages: CapturedPage[], threshold: number): ClusterResult[] {
  const usableCount = pages.filter((page) => page.id != null && page.embedding?.length).length;
  if (usableCount <= AGGLOMERATIVE_MAX_PAGES) {
    return agglomerative(pages, threshold);
  }

  return incremental(pages, threshold);
}

function mergeKeywords(left: string[], right: string[]): string[] {
  const counts = new Map<string, number>();
  for (const keyword of [...left, ...right]) {
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([keyword]) => keyword);
}

const PALETTE = [
  '#7c5cff',
  '#2dd4bf',
  '#f59e0b',
  '#f87171',
  '#60a5fa',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#facc15',
  '#22d3ee',
];

export function clusterColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function clusterLabel(keywords: string[]): string {
  if (!keywords.length) return 'Untitled cluster';

  return keywords
    .slice(0, 2)
    .map((keyword) => keyword[0].toUpperCase() + keyword.slice(1))
    .join(' / ');
}
