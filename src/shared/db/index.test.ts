import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  deleteAll,
  exportAll,
  getSettings,
  importAll,
  updateSettings,
  upsertPage,
} from './index';
import type { CapturedPage } from '@shared/types';

function makePage(overrides: Partial<CapturedPage> = {}): CapturedPage {
  return {
    url: 'https://example.com/article',
    urlHash: 'hash-1',
    title: 'Example article',
    domain: 'example.com',
    excerpt: 'excerpt',
    content: 'content',
    wordCount: 300,
    capturedAt: 1,
    lastVisitedAt: 1,
    visitCount: 1,
    dwellMs: 15000,
    embedding: [1, 0],
    keywords: ['react', 'hooks'],
    clusterId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await db.pages.clear();
  await db.clusters.clear();
  await db.connections.clear();
  await db.resurfaces.clear();
  await db.settings.clear();
});

afterAll(async () => {
  await db.delete();
});

describe('upsertPage', () => {
  it('merges revisits onto the existing page record', async () => {
    const pageId = await upsertPage(makePage());

    const mergedId = await upsertPage(
      makePage({
        excerpt: 'updated excerpt',
        dwellMs: 5000,
        embedding: [],
      })
    );

    const stored = await db.pages.get(pageId);

    expect(mergedId).toBe(pageId);
    expect(stored?.visitCount).toBe(2);
    expect(stored?.dwellMs).toBe(20000);
    expect(stored?.excerpt).toBe('updated excerpt');
    expect(stored?.embedding).toEqual([1, 0]);
  });
});

describe('deleteAll', () => {
  it('clears captured data but keeps settings intact', async () => {
    const pageId = await db.pages.add(makePage());
    const clusterId = (await db.clusters.add({
      label: 'React / Hooks',
      keywords: ['react', 'hooks'],
      centroid: [1, 0],
      pageIds: [pageId],
      createdAt: 1,
      updatedAt: 1,
      color: '#7c5cff',
    })) as number;

    await db.pages.update(pageId, { clusterId });
    await db.connections.add({
      sourceId: pageId,
      targetId: pageId + 1,
      similarity: 0.9,
      createdAt: 1,
    });
    await db.resurfaces.add({
      pageId,
      triggeredByUrl: 'https://example.com/current',
      similarity: 0.91,
      shownAt: 1,
      dismissed: false,
      clicked: false,
    });
    await updateSettings({ dwellThresholdMs: 30_000 });

    await deleteAll();

    expect(await db.pages.count()).toBe(0);
    expect(await db.clusters.count()).toBe(0);
    expect(await db.connections.count()).toBe(0);
    expect(await db.resurfaces.count()).toBe(0);
    expect((await getSettings()).dwellThresholdMs).toBe(30_000);
  });
});

describe('exportAll and importAll', () => {
  it('round-trips the stored graph data and settings', async () => {
    const pageId = await db.pages.add(makePage());
    const clusterId = (await db.clusters.add({
      label: 'React / Hooks',
      keywords: ['react', 'hooks'],
      centroid: [1, 0],
      pageIds: [pageId],
      createdAt: 1,
      updatedAt: 1,
      color: '#7c5cff',
    })) as number;

    await db.pages.update(pageId, { clusterId });
    await db.connections.add({
      sourceId: pageId,
      targetId: pageId + 1,
      similarity: 0.9,
      createdAt: 1,
    });
    await db.resurfaces.add({
      pageId,
      triggeredByUrl: 'https://example.com/current',
      similarity: 0.91,
      shownAt: 1,
      dismissed: false,
      clicked: false,
    });
    await updateSettings({ minWordCount: 250, blockedDomains: ['example.com'] });

    const exported = await exportAll();

    await db.pages.clear();
    await db.clusters.clear();
    await db.connections.clear();
    await db.resurfaces.clear();
    await db.settings.clear();

    await importAll(exported);

    expect(await db.pages.count()).toBe(1);
    expect(await db.clusters.count()).toBe(1);
    expect(await db.connections.count()).toBe(1);
    expect(await db.resurfaces.count()).toBe(1);
    expect((await getSettings()).minWordCount).toBe(250);
    expect((await getSettings()).blockedDomains).toEqual(['example.com']);
  });
});
