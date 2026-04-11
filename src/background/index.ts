import {
  db,
  upsertPage,
  getSettings,
  deleteAll,
  exportAll,
  importAll,
} from '@shared/db';
import { embed, warmup, cosineSimilarity } from '@shared/embeddings';
import { agglomerative, clusterColor, clusterLabel } from '@shared/utils/cluster';
import { extractKeywords } from '@shared/utils/keywords';
import { hashUrl, domainOf } from '@shared/utils/hash';
import type { BgMessage, BgResponse, CapturedPage, SearchResult } from '@shared/types';

console.log('[synapse] background worker booting');

// ─── Model readiness ─────────────────────────────────────────────────────────
// Tracked per SW session. Resets to false when SW wakes from cold start.
let modelReady = false;

async function ensureModel(): Promise<void> {
  if (modelReady) return;
  await warmup();
  modelReady = true;
}

// ─── Persistent job queue ────────────────────────────────────────────────────
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
let processingQueue = false;

async function enqueueJob(job: PendingJob): Promise<void> {
  const { [JOB_KEY]: existing = [] } = await chrome.storage.session.get(JOB_KEY);
  const jobs = existing as PendingJob[];
  const deduped = jobs.filter((j) => j.urlHash !== job.urlHash);
  deduped.push(job);
  await chrome.storage.session.set({ [JOB_KEY]: deduped });
}

async function drainQueue(): Promise<void> {
  if (processingQueue) return;
  processingQueue = true;
  try {
    while (true) {
      const { [JOB_KEY]: jobs = [] } = await chrome.storage.session.get(JOB_KEY);
      const queue = jobs as PendingJob[];
      if (queue.length === 0) break;
      const job = queue[0];
      const success = await processJob(job);
      if (success) {
        const { [JOB_KEY]: current = [] } = await chrome.storage.session.get(JOB_KEY);
        const remaining = (current as PendingJob[]).filter((j) => j.urlHash !== job.urlHash);
        await chrome.storage.session.set({ [JOB_KEY]: remaining });
      } else {
        break;
      }
    }
  } finally {
    processingQueue = false;
  }
}

async function processJob(job: PendingJob): Promise<boolean> {
  try {
    const existing = await db.pages.where('urlHash').equals(job.urlHash).first();

    let embedding: number[] = existing?.embedding ?? [];
    if (!existing) {
      embedding = await embed(`${job.title}\n\n${job.content}`);
      modelReady = true;
    }

    const keywords = extractKeywords(job.content);
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
      keywords,
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
  } catch (e) {
    console.error('[synapse] processJob failed', e);
    return false;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  console.log('[synapse] installed, settings initialized');
  void ensureModel().then(() => {
    console.log('[synapse] model warmed up');
    void drainQueue();
  });
});

chrome.runtime.onStartup.addListener(() => {
  void ensureModel().then(() => void drainQueue());
});

// Wake the model as soon as the SW starts (handles cases beyond onInstalled/onStartup)
void ensureModel().then(() => void drainQueue());

// ─── Message router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: BgMessage, _sender, sendResponse) => {
  handleMessage(msg)
    .then((res) => sendResponse(res))
    .catch((err) => {
      console.error('[synapse] handler error', err);
      sendResponse({ ok: false, error: String(err?.message ?? err) } satisfies BgResponse);
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
      await deleteAll();
      return { ok: true };
    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
      return { ok: false, error: 'unknown message' };
    }
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCapture(
  payload: Extract<BgMessage, { type: 'PAGE_CAPTURED' }>['payload']
): Promise<BgResponse> {
  const settings = await getSettings();
  if (!settings.captureEnabled) return { ok: true };
  if (payload.wordCount < settings.minWordCount) return { ok: true };
  if (isDomainBlocked(payload.url, settings.blockedDomains)) return { ok: true };

  const urlHash = hashUrl(payload.url);
  await enqueueJob({
    urlHash,
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

  const toResult = (p: CapturedPage, score: number): SearchResult => ({
    id: p.id as number,
    url: p.url,
    title: p.title,
    domain: p.domain,
    excerpt: p.excerpt,
    capturedAt: p.capturedAt,
    wordCount: p.wordCount,
    keywords: p.keywords,
    favicon: p.favicon,
    score,
  });

  if (payload.mode === 'keyword') {
    const needle = payload.query.toLowerCase();
    const results: SearchResult[] = pages
      .map((p) => {
        const hay = `${p.title} ${p.excerpt} ${p.content}`.toLowerCase();
        const idx = hay.indexOf(needle);
        return { p, score: idx === -1 ? 0 : 1 - idx / hay.length };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => toResult(x.p, x.score));
    return { ok: true, data: results };
  }

  // Semantic search
  let queryVec: number[];
  try {
    await ensureModel();
    queryVec = await embed(payload.query);
    modelReady = true;
  } catch (e) {
    return { ok: false, error: 'Embedding model not ready yet — try again in a moment.' };
  }

  const results: SearchResult[] = pages
    .filter((p) => p.embedding?.length)
    .map((p) => ({ p, score: cosineSimilarity(queryVec, p.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => toResult(x.p, x.score));

  return { ok: true, data: results };
}

async function handleResurface(
  payload: Extract<BgMessage, { type: 'GET_RESURFACE' }>['payload']
): Promise<BgResponse> {
  const settings = await getSettings();
  if (!settings.resurfaceEnabled) return { ok: true, data: [] };

  const currentHash = hashUrl(payload.url);
  const all = await db.pages.toArray();
  if (all.length < 3) return { ok: true, data: [] };

  let queryVec: number[];
  try {
    queryVec = await embed(payload.content.slice(0, 1500));
  } catch {
    return { ok: true, data: [] };
  }

  const cooldown = Date.now() - settings.resurfaceCooldownMs;
  const recent = await db.resurfaces.where('shownAt').above(cooldown).toArray();
  const recentIds = new Set(recent.map((r) => r.pageId));

  const scored = all
    .filter((p) => p.urlHash !== currentHash && !recentIds.has(p.id as number))
    .filter((p) => p.embedding?.length)
    .map((p) => ({ page: p, sim: cosineSimilarity(queryVec, p.embedding) }))
    .filter((x) => x.sim >= settings.similarityThreshold)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3);

  for (const s of scored) {
    await db.resurfaces.add({
      pageId: s.page.id as number,
      triggeredByUrl: payload.url,
      similarity: s.sim,
      shownAt: Date.now(),
      dismissed: false,
      clicked: false,
    });
  }

  return {
    ok: true,
    data: scored.map((s) => ({ title: s.page.title, url: s.page.url, similarity: s.sim })),
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
    },
  };
}

// ─── Graph maintenance ───────────────────────────────────────────────────────

async function rebuildConnectionsForPage(pageId: number, threshold: number) {
  const target = await db.pages.get(pageId);
  if (!target || !target.embedding?.length) return;

  const all = await db.pages.toArray();
  const links: { sourceId: number; targetId: number; similarity: number }[] = [];
  for (const other of all) {
    if (other.id == null || other.id === pageId || !other.embedding?.length) continue;
    const sim = cosineSimilarity(target.embedding, other.embedding);
    if (sim >= threshold) {
      links.push({
        sourceId: Math.min(pageId, other.id),
        targetId: Math.max(pageId, other.id),
        similarity: sim,
      });
    }
  }

  await db.transaction('rw', db.connections, async () => {
    await db.connections.where('sourceId').equals(pageId).or('targetId').equals(pageId).delete();
    for (const l of links) {
      const exists = await db.connections
        .where('[sourceId+targetId]')
        .equals([l.sourceId, l.targetId])
        .first();
      if (!exists) await db.connections.add({ ...l, createdAt: Date.now() });
    }
  });
}

let reclusterTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRecluster() {
  if (reclusterTimer !== undefined) clearTimeout(reclusterTimer);
  reclusterTimer = setTimeout(() => void recluster(), 5000);
}

const MAX_CLUSTER_PAGES = 200;

async function recluster() {
  const settings = await getSettings();
  let pages = await db.pages.toArray();
  if (pages.length < 3) return;

  // Performance cap: agglomerative is O(n³) — cap at most-recent 200 pages
  if (pages.length > MAX_CLUSTER_PAGES) {
    pages = pages.sort((a, b) => b.capturedAt - a.capturedAt).slice(0, MAX_CLUSTER_PAGES);
    console.log(`[synapse] clustering capped at ${MAX_CLUSTER_PAGES} pages`);
  }

  const results = agglomerative(pages, settings.clusterThreshold);

  await db.transaction('rw', [db.clusters, db.pages], async () => {
    await db.clusters.clear();
    await db.pages.toCollection().modify({ clusterId: null });
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const id = (await db.clusters.add({
        label: clusterLabel(r.keywords),
        keywords: r.keywords,
        centroid: r.centroid,
        pageIds: r.pageIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: clusterColor(i),
      })) as number;
      for (const pid of r.pageIds) await db.pages.update(pid, { clusterId: id });
    }
  });

  console.log(`[synapse] reclustered into ${results.length} clusters`);
}

async function handleReindex(): Promise<BgResponse> {
  const pages = await db.pages.toArray();
  for (const p of pages) {
    try {
      const vec = await embed(`${p.title}\n\n${p.content}`);
      await db.pages.update(p.id as number, { embedding: vec });
      modelReady = true;
    } catch (e) {
      console.warn('[synapse] reindex page failed', p.id, e);
    }
  }
  await recluster();
  return { ok: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDomainBlocked(url: string, blockedDomains: string[]): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
  return blockedDomains.some((blocked) => {
    const b = blocked.replace(/^www\./, '').toLowerCase();
    const h = hostname.toLowerCase();
    return h === b || h.endsWith('.' + b);
  });
}
