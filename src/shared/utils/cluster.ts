import { cosineSimilarity } from '@shared/embeddings';
import type { CapturedPage } from '@shared/types';

export interface ClusterResult {
  pageIds: number[];
  centroid: number[];
  keywords: string[];
}

function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  // normalize so future cosine = dot
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) out[i] /= norm;
  return out;
}

/**
 * Simple agglomerative clustering: each page starts as its own cluster,
 * repeatedly merge the two closest clusters while their similarity is above
 * `threshold`.
 */
export function agglomerative(pages: CapturedPage[], threshold: number): ClusterResult[] {
  const usable = pages.filter((p) => p.id != null && p.embedding?.length);
  if (usable.length === 0) return [];

  type C = { ids: number[]; centroid: number[]; vectors: number[][]; keywords: string[] };
  let clusters: C[] = usable.map((p) => ({
    ids: [p.id as number],
    centroid: p.embedding,
    vectors: [p.embedding],
    keywords: p.keywords.slice(0, 4),
  }));

  while (true) {
    let bestI = -1;
    let bestJ = -1;
    let bestSim = threshold;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const s = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
        if (s > bestSim) {
          bestSim = s;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI === -1) break;

    const a = clusters[bestI];
    const b = clusters[bestJ];
    const mergedVectors = [...a.vectors, ...b.vectors];
    const merged: C = {
      ids: [...a.ids, ...b.ids],
      vectors: mergedVectors,
      centroid: meanVector(mergedVectors),
      keywords: mergeKeywords(a.keywords, b.keywords),
    };
    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }

  return clusters
    .filter((c) => c.ids.length >= 2)
    .map((c) => ({
      pageIds: c.ids,
      centroid: c.centroid,
      keywords: c.keywords.slice(0, 5),
    }));
}

function mergeKeywords(a: string[], b: string[]): string[] {
  const freq = new Map<string, number>();
  for (const k of [...a, ...b]) freq.set(k, (freq.get(k) ?? 0) + 1);
  return [...freq.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
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

export function clusterColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export function clusterLabel(keywords: string[]): string {
  if (!keywords.length) return 'Untitled cluster';
  return keywords
    .slice(0, 2)
    .map((k) => k[0].toUpperCase() + k.slice(1))
    .join(' · ');
}
