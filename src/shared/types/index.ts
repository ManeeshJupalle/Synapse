export interface CapturedPage {
  id?: number;
  url: string;
  urlHash: string;
  title: string;
  domain: string;
  excerpt: string;
  content: string;
  wordCount: number;
  capturedAt: number;
  lastVisitedAt: number;
  visitCount: number;
  dwellMs: number;
  embedding: number[];
  keywords: string[];
  clusterId?: number | null;
  favicon?: string;
}

export interface Cluster {
  id?: number;
  label: string;
  keywords: string[];
  centroid: number[];
  pageIds: number[];
  createdAt: number;
  updatedAt: number;
  color: string;
}

export interface Connection {
  id?: number;
  sourceId: number;
  targetId: number;
  similarity: number;
  createdAt: number;
}

export interface ResurfaceEvent {
  id?: number;
  pageId: number;
  triggeredByUrl: string;
  similarity: number;
  shownAt: number;
  dismissed: boolean;
  clicked: boolean;
}

export interface Settings {
  id?: number;
  dwellThresholdMs: number;
  minWordCount: number;
  similarityThreshold: number;
  connectionThreshold: number;
  clusterThreshold: number;
  resurfaceEnabled: boolean;
  resurfaceCooldownMs: number;
  captureEnabled: boolean;
  blockedDomains: string[];
  darkMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  dwellThresholdMs: 15_000,
  minWordCount: 150,
  similarityThreshold: 0.55,
  connectionThreshold: 0.65,
  clusterThreshold: 0.6,
  resurfaceEnabled: true,
  resurfaceCooldownMs: 6 * 60 * 60 * 1000,
  captureEnabled: true,
  blockedDomains: [
    'mail.google.com',
    'calendar.google.com',
    'drive.google.com',
    'docs.google.com',
    'github.com/settings',
    'accounts.google.com',
    'chrome://',
    'localhost',
  ],
  darkMode: true,
};

export type BgMessage =
  | {
      type: 'PAGE_CAPTURED';
      payload: {
        url: string;
        title: string;
        content: string;
        excerpt: string;
        dwellMs: number;
        wordCount: number;
        favicon?: string;
      };
    }
  | { type: 'GET_RESURFACE'; payload: { url: string; content: string } }
  | { type: 'GET_STATUS' }
  | { type: 'REINDEX' }
  | { type: 'EXPORT_DATA' }
  | { type: 'IMPORT_DATA'; payload: string }
  | { type: 'DELETE_ALL' };

export type BgResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
