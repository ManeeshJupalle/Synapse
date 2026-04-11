import {
  db,
  upsertPage,
  getSettings,
  deleteAll,
  exportAll,
  importAll,
} from '@shared/db';
import { embed, cosineSimilarity } from '@shared/embeddings';
import { agglomerative, clusterColor, clusterLabel } from '@shared/utils/cluster';
import { extractKeywords } from '@shared/utils/keywords';
import { hashUrl, domainOf } from '@shared/utils/hash';
import type { BgMessage, BgResponse, CapturedPage } from '@shared/types';

console.log('[synapse] background worker booting');

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  console.log('[synapse] installed, settings initialized');
});

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

async function handleCapture(
  payload: Extract<BgMessage, { type: 'PAGE_CAPTURED' }>['payload']
): Promise<BgResponse> {
  const settings = await getSettings();
  if (!settings.captureEnabled) return { ok: true };

  const domain = domainOf(payload.url);
  if (settings.blockedDomains.some((d) => payload.url.includes(d) || domain.includes(d))) {
    return { ok: true };
  }
  if (payload.wordCount < settings.minWordCount) return { ok: true };

  const urlHash = hashUrl(payload.url);
  const existing = await db.pages.where('urlHash').equals(urlHash).first();

  let embedding: number[] = existing?.embedding ?? [];
  if (!existing) {
    try {
      embedding = await embed(`${payload.title}\n\n${payload.content}`);
    } catch (e) {
      console.error('[synapse] embed failed', e);
      return { ok: false, error: 'embed failed' };
    }
  }

  const keywords = extractKeywords(payload.content);

  const page: CapturedPage = {
    urlHash,
    url: payload.url,
    title: payload.title,
    domain,
    excerpt: payload.excerpt,
    content: payload.content.slice(0, 8000),
    wordCount: payload.wordCount,
    capturedAt: existing?.capturedAt ?? Date.now(),
    lastVisitedAt: Date.now(),
    visitCount: 1,
    dwellMs: payload.dwellMs,
    embedding,
    keywords,
    clusterId: existing?.clusterId ?? null,
    favicon: payload.favicon,
  };

  const pageId = await upsertPage(page);

  if (!existing) {
    void rebuildConnectionsForPage(pageId);
    void scheduleRecluster();
  }

  return { ok: true, data: { id: pageId } };
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
    .map((p) => ({
      page: p,
      sim: cosineSimilarity(queryVec, p.embedding),
    }))
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
    data: scored.map((s) => ({
      title: s.page.title,
      url: s.page.url,
      similarity: s.sim,
    })),
  };
}

async function handleStatus(): Promise<BgResponse> {
  const [pages, clusters, connections] = await Promise.all([
    db.pages.count(),
    db.clusters.count(),
    db.connections.count(),
  ]);
  return { ok: true, data: { pages, clusters, connections } };
}

async function rebuildConnectionsForPage(pageId: number) {
  const settings = await getSettings();
  const target = await db.pages.get(pageId);
  if (!target || !target.embedding?.length) return;

  const all = await db.pages.toArray();
  const links: { sourceId: number; targetId: number; similarity: number }[] = [];
  for (const other of all) {
    if (other.id == null || other.id === pageId) continue;
    if (!other.embedding?.length) continue;
    const sim = cosineSimilarity(target.embedding, other.embedding);
    if (sim >= settings.connectionThreshold) {
      links.push({
        sourceId: Math.min(pageId, other.id),
        targetId: Math.max(pageId, other.id),
        similarity: sim,
      });
    }
  }

  await db.transaction('rw', db.connections, async () => {
    await db.connections
      .where('sourceId')
      .equals(pageId)
      .or('targetId')
      .equals(pageId)
      .delete();
    for (const l of links) {
      await db.connections.add({ ...l, createdAt: Date.now() });
    }
  });
}

let reclusterTimer: number | undefined;
function scheduleRecluster() {
  if (reclusterTimer !== undefined) clearTimeout(reclusterTimer);
  reclusterTimer = setTimeout(() => void recluster(), 5000) as unknown as number;
}

async function recluster() {
  const settings = await getSettings();
  const pages = await db.pages.toArray();
  if (pages.length < 3) return;

  const results = agglomerative(pages, settings.clusterThreshold);

  await db.transaction('rw', db.clusters, db.pages, async () => {
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
      for (const pid of r.pageIds) {
        await db.pages.update(pid, { clusterId: id });
      }
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
    } catch (e) {
      console.warn('[synapse] reindex page failed', p.id, e);
    }
  }
  await recluster();
  return { ok: true };
}
