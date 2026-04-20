import {
  db,
  deleteAll,
  exportAll,
  getSettings,
  importAll,
  syncSettingsToStorage,
  upsertPage,
} from '@shared/db';
import { cosineSimilarity, embed, warmup } from '@shared/embeddings';
import { clusterColor, clusterLabel, clusterPages } from '@shared/utils/cluster';
import { hashUrl, domainOf } from '@shared/utils/hash';
import { extractKeywords } from '@shared/utils/keywords';
import type { BgMessage, BgResponse, CapturedPage, SearchResult } from '@shared/types';

console.log('[synapse] background worker booting');

interface PendingJob {
  urlHash: string;
  url: string;
  title: string;
  content: string;
  excerpt: string;
  wordCount: number;
  dwellMs: number;
  favicon?: string;
  addedAt: number;
}

const JOB_KEY = 'synapse_pending_jobs';
let modelReady = false;
let modelError: string | null = null;
let modelInitPromise: Promise<void> | null = null;
let processingQueue = false;
let queueVersion = 0;
let reclusterTimer: ReturnType<typeof setTimeout> | undefined;

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? 'Unknown error');
}

async function ensureModel(): Promise<void> {
  if (modelReady) return;
  if (modelInitPromise) return modelInitPromise;

  modelInitPromise = (async () => {
    try {
      modelError = null;
      await warmup();
      modelReady = true;
    } catch (error) {
      modelReady = false;
      modelError = formatError(error);
      throw error;
    } finally {
      modelInitPromise = null;
    }
  })();

  return modelInitPromise;
}

function setModelReadyState(): void {
  modelReady = true;
  modelError = null;
}

function setModelErrorState(error: unknown): void {
  modelReady = false;
  modelError = formatError(error);
}

function warmModelInBackground(context: string): void {
  void ensureModel().catch((error) => {
    console.warn(`[synapse] ${context} failed`, error);
  });
}

function syncSettingsMirror(): void {
  void getSettings().then((settings) => syncSettingsToStorage(settings));
}

async function enqueueJob(job: PendingJob): Promise<void> {
  const { [JOB_KEY]: existing = [] } = await chrome.storage.session.get(JOB_KEY);
  const deduped = (existing as PendingJob[]).filter((item) => item.urlHash !== job.urlHash);
  deduped.push(job);
  await chrome.storage.session.set({ [JOB_KEY]: deduped });
}

async function clearPendingJobs(): Promise<void> {
  await chrome.storage.session.remove(JOB_KEY);
}

async function resetCapturedData(): Promise<void> {
  queueVersion += 1;
  await clearPendingJobs();
  await deleteAll();
}

async function drainQueue(runVersion = queueVersion): Promise<void> {
  if (processingQueue) return;
  processingQueue = true;

  try {
    while (runVersion === queueVersion) {
      const { [JOB_KEY]: jobs = [] } = await chrome.storage.session.get(JOB_KEY);
      const queue = jobs as PendingJob[];
      if (queue.length === 0) break;

      const job = queue[0];
      const success = await processJob(job, runVersion);
      if (runVersion !== queueVersion) break;

      if (!success) break;

      const { [JOB_KEY]: current = [] } = await chrome.storage.session.get(JOB_KEY);
      const remaining = (current as PendingJob[]).filter((item) => item.urlHash !== job.urlHash);
      await chrome.storage.session.set({ [JOB_KEY]: remaining });
    }
  } finally {
    processingQueue = false;
  }
}

async function processJob(job: PendingJob, runVersion: number): Promise<boolean> {
  try {
    const existing = await db.pages.where('urlHash').equals(job.urlHash).first();

    let embedding: number[] = existing?.embedding ?? [];
    if (!existing) {
      await ensureModel();
      embedding = await embed(`${job.title}\n\n${job.content}`);
      setModelReadyState();
    }

    if (runVersion !== queueVersion) {
      return false;
    }

    const page: CapturedPage = {
      urlHash: job.urlHash,
      url: job.url,
      title: job.title,
      domain: domainOf(job.url),
      excerpt: job.excerpt,
      content: job.content.slice(0, 8000),
      wordCount: job.wordCount,
      capturedAt: existing?.capturedAt ?? Date.now(),
      lastVisitedAt: Date.now(),
      visitCount: 1,
      dwellMs: job.dwellMs,
      embedding,
      keywords: extractKeywords(job.content),
      clusterId: existing?.clusterId ?? null,
      favicon: job.favicon,
    };

    const pageId = await upsertPage(page);
    const settings = await getSettings();
    if (!existing) {
      void rebuildConnectionsForPage(pageId, settings.connectionThreshold);
      scheduleRecluster();
    }

    return true;
  } catch (error) {
    setModelErrorState(error);
    console.error('[synapse] processJob failed', error);
    return false;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  syncSettingsMirror();
  console.log('[synapse] installed, settings initialized');
  warmModelInBackground('model warmup');
  void drainQueue();
});

chrome.runtime.onStartup.addListener(() => {
  syncSettingsMirror();
  warmModelInBackground('startup model warmup');
  void drainQueue();
});

syncSettingsMirror();
warmModelInBackground('service worker model warmup');
void drainQueue();

chrome.runtime.onMessage.addListener((msg: BgMessage, _sender, sendResponse) => {
  handleMessage(msg)
    .then((res) => sendResponse(res))
    .catch((error) => {
      console.error('[synapse] handler error', error);
      sendResponse({ ok: false, error: formatError(error) } satisfies BgResponse);
    });
  return true;
});

async function handleMessage(msg: BgMessage): Promise<BgResponse> {
  switch (msg.type) {
    case 'PAGE_CAPTURED':
      return handleCapture(msg.payload);
    case 'GET_RESURFACE':
      return handleResurface(msg.payload);
    case 'SEARCH':
      return handleSearch(msg.payload);
    case 'GET_STATUS':
      return handleStatus();
    case 'REINDEX':
      return handleReindex();
    case 'EXPORT_DATA':
      return { ok: true, data: await exportAll() };
    case 'IMPORT_DATA':
      await importAll(msg.payload);
      return { ok: true };
    case 'DELETE_ALL':
      await resetCapturedData();
      return { ok: true };
    default: {
      const exhaustive: never = msg;
      void exhaustive;
      return { ok: false, error: 'unknown message' };
    }
  }
}

async function handleCapture(
  payload: Extract<BgMessage, { type: 'PAGE_CAPTURED' }>['payload']
): Promise<BgResponse> {
  const settings = await getSettings();
  if (!settings.captureEnabled) return { ok: true };
  if (payload.wordCount < settings.minWordCount) return { ok: true };
  if (isDomainBlocked(payload.url, settings.blockedDomains)) return { ok: true };

  await enqueueJob({
    urlHash: hashUrl(payload.url),
    url: payload.url,
    title: payload.title,
    content: payload.content,
    excerpt: payload.excerpt,
    wordCount: payload.wordCount,
    dwellMs: payload.dwellMs,
    favicon: payload.favicon,
    addedAt: Date.now(),
  });

  void drainQueue();
  return { ok: true };
}

async function handleSearch(
  payload: Extract<BgMessage, { type: 'SEARCH' }>['payload']
): Promise<BgResponse> {
  const pages = await db.pages.toArray();
  if (pages.length === 0) return { ok: true, data: [] };

  const toResult = (page: CapturedPage, score: number): SearchResult => ({
    id: page.id as number,
    url: page.url,
    title: page.title,
    domain: page.domain,
    excerpt: page.excerpt,
    capturedAt: page.capturedAt,
    wordCount: page.wordCount,
    keywords: page.keywords,
    favicon: page.favicon,
    score,
  });

  if (payload.mode === 'keyword') {
    const needle = payload.query.toLowerCase();
    const results = pages
      .map((page) => {
        const haystack = `${page.title} ${page.excerpt} ${page.content}`.toLowerCase();
        const index = haystack.indexOf(needle);
        return { page, score: index === -1 ? 0 : 1 - index / haystack.length };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((entry) => toResult(entry.page, entry.score));

    return { ok: true, data: results };
  }

  try {
    await ensureModel();
    const queryVec = await embed(payload.query);
    setModelReadyState();

    const results = pages
      .filter((page) => page.embedding?.length)
      .map((page) => ({ page, score: cosineSimilarity(queryVec, page.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((entry) => toResult(entry.page, entry.score));

    return { ok: true, data: results };
  } catch (error) {
    setModelErrorState(error);
    return {
      ok: false,
      error: modelError ?? 'Embedding model not ready yet. Try again in a moment.',
    };
  }
}

async function handleResurface(
  payload: Extract<BgMessage, { type: 'GET_RESURFACE' }>['payload']
): Promise<BgResponse> {
  const settings = await getSettings();
  if (!settings.resurfaceEnabled) return { ok: true, data: [] };

  const currentHash = hashUrl(payload.url);
  const allPages = await db.pages.toArray();
  if (allPages.length < 3) return { ok: true, data: [] };

  let queryVec: number[];
  try {
    await ensureModel();
    queryVec = await embed(payload.content.slice(0, 1500));
    setModelReadyState();
  } catch (error) {
    setModelErrorState(error);
    return { ok: true, data: [] };
  }

  const cooldown = Date.now() - settings.resurfaceCooldownMs;
  const recent = await db.resurfaces.where('shownAt').above(cooldown).toArray();
  const recentIds = new Set(recent.map((entry) => entry.pageId));

  const scored = allPages
    .filter((page) => page.urlHash !== currentHash && !recentIds.has(page.id as number))
    .filter((page) => page.embedding?.length)
    .map((page) => ({ page, similarity: cosineSimilarity(queryVec, page.embedding) }))
    .filter((entry) => entry.similarity >= settings.similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  for (const entry of scored) {
    await db.resurfaces.add({
      pageId: entry.page.id as number,
      triggeredByUrl: payload.url,
      similarity: entry.similarity,
      shownAt: Date.now(),
      dismissed: false,
      clicked: false,
    });
  }

  return {
    ok: true,
    data: scored.map((entry) => ({
      title: entry.page.title,
      url: entry.page.url,
      similarity: entry.similarity,
    })),
  };
}

async function handleStatus(): Promise<BgResponse> {
  const { [JOB_KEY]: jobs = [] } = await chrome.storage.session.get(JOB_KEY);
  const [pages, clusters, connections] = await Promise.all([
    db.pages.count(),
    db.clusters.count(),
    db.connections.count(),
  ]);

  return {
    ok: true,
    data: {
      pages,
      clusters,
      connections,
      pendingJobs: (jobs as PendingJob[]).length,
      modelReady,
      modelLoading: modelInitPromise !== null,
      modelError,
    },
  };
}

async function rebuildConnectionsForPage(pageId: number, threshold: number): Promise<void> {
  const target = await db.pages.get(pageId);
  if (!target || !target.embedding?.length) return;

  const allPages = await db.pages.toArray();
  const links: { sourceId: number; targetId: number; similarity: number }[] = [];

  for (const page of allPages) {
    if (page.id == null || page.id === pageId || !page.embedding?.length) continue;

    const similarity = cosineSimilarity(target.embedding, page.embedding);
    if (similarity >= threshold) {
      links.push({
        sourceId: Math.min(pageId, page.id),
        targetId: Math.max(pageId, page.id),
        similarity,
      });
    }
  }

  await db.transaction('rw', db.connections, async () => {
    await db.connections.where('sourceId').equals(pageId).or('targetId').equals(pageId).delete();

    for (const link of links) {
      const existing = await db.connections
        .where('[sourceId+targetId]')
        .equals([link.sourceId, link.targetId])
        .first();

      if (!existing) {
        await db.connections.add({ ...link, createdAt: Date.now() });
      }
    }
  });
}

function scheduleRecluster(): void {
  if (reclusterTimer !== undefined) clearTimeout(reclusterTimer);
  reclusterTimer = setTimeout(() => void recluster(), 5000);
}

async function recluster(): Promise<void> {
  const settings = await getSettings();
  const pages = await db.pages.toArray();
  if (pages.length < 3) return;

  const results = clusterPages(pages, settings.clusterThreshold);

  await db.transaction('rw', [db.clusters, db.pages], async () => {
    await db.clusters.clear();
    await db.pages.toCollection().modify({ clusterId: null });

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const clusterId = (await db.clusters.add({
        label: clusterLabel(result.keywords),
        keywords: result.keywords,
        centroid: result.centroid,
        pageIds: result.pageIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: clusterColor(index),
      })) as number;

      for (const pageId of result.pageIds) {
        await db.pages.update(pageId, { clusterId });
      }
    }
  });

  console.log(`[synapse] reclustered into ${results.length} clusters`);
}

async function handleReindex(): Promise<BgResponse> {
  const pages = await db.pages.toArray();

  for (const page of pages) {
    try {
      await ensureModel();
      const embedding = await embed(`${page.title}\n\n${page.content}`);
      await db.pages.update(page.id as number, { embedding });
      setModelReadyState();
    } catch (error) {
      setModelErrorState(error);
      console.warn('[synapse] reindex page failed', page.id, error);
    }
  }

  await recluster();
  return { ok: true };
}

function isDomainBlocked(url: string, blockedDomains: string[]): boolean {
  let hostname: string;

  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }

  return blockedDomains.some((blocked) => {
    const normalizedBlocked = blocked.replace(/^www\./, '').toLowerCase();
    const normalizedHost = hostname.toLowerCase();
    return normalizedHost === normalizedBlocked || normalizedHost.endsWith('.' + normalizedBlocked);
  });
}
