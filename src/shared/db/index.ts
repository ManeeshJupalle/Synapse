import Dexie, { type Table } from 'dexie';
import {
  type CapturedPage,
  type Cluster,
  type Connection,
  type ResurfaceEvent,
  type Settings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from '@shared/types';

class SynapseDB extends Dexie {
  pages!: Table<CapturedPage, number>;
  clusters!: Table<Cluster, number>;
  connections!: Table<Connection, number>;
  resurfaces!: Table<ResurfaceEvent, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('synapse');
    this.version(1).stores({
      pages: '++id, urlHash, domain, capturedAt, lastVisitedAt, clusterId, *keywords',
      clusters: '++id, label, updatedAt',
      connections: '++id, sourceId, targetId, similarity, [sourceId+targetId]',
      resurfaces: '++id, pageId, shownAt',
      settings: 'id',
    });
  }
}

export const db = new SynapseDB();

export async function syncSettingsToStorage(settings: Settings): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
  } catch {
    // Ignore storage mirror failures outside extension runtime contexts.
  }
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get(1);
  if (!s) {
    await db.settings.put(DEFAULT_SETTINGS);
    await syncSettingsToStorage(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: 1 };
  await db.settings.put(next);
  await syncSettingsToStorage(next);
  return next;
}

export async function upsertPage(page: CapturedPage): Promise<number> {
  const existing = await db.pages.where('urlHash').equals(page.urlHash).first();
  if (existing && existing.id != null) {
    const merged: CapturedPage = {
      ...existing,
      ...page,
      id: existing.id,
      visitCount: existing.visitCount + 1,
      dwellMs: existing.dwellMs + page.dwellMs,
      lastVisitedAt: Date.now(),
      embedding: page.embedding.length ? page.embedding : existing.embedding,
    };
    await db.pages.put(merged);
    return existing.id;
  }
  return (await db.pages.add(page)) as number;
}

export async function getAllPages(): Promise<CapturedPage[]> {
  return db.pages.orderBy('capturedAt').reverse().toArray();
}

export async function getPageById(id: number): Promise<CapturedPage | undefined> {
  return db.pages.get(id);
}

export async function deleteAll(): Promise<void> {
  await db.transaction(
    'rw',
    db.pages,
    db.clusters,
    db.connections,
    db.resurfaces,
    async () => {
      await db.pages.clear();
      await db.clusters.clear();
      await db.connections.clear();
      await db.resurfaces.clear();
    }
  );
}

export async function exportAll(): Promise<string> {
  const [pages, clusters, connections, resurfaces, settings] = await Promise.all([
    db.pages.toArray(),
    db.clusters.toArray(),
    db.connections.toArray(),
    db.resurfaces.toArray(),
    db.settings.toArray(),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: Date.now(), pages, clusters, connections, resurfaces, settings },
    null,
    2
  );
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction(
    'rw',
    [db.pages, db.clusters, db.connections, db.resurfaces, db.settings],
    async () => {
      if (Array.isArray(data.pages)) await db.pages.bulkPut(data.pages);
      if (Array.isArray(data.clusters)) await db.clusters.bulkPut(data.clusters);
      if (Array.isArray(data.connections)) await db.connections.bulkPut(data.connections);
      if (Array.isArray(data.resurfaces)) await db.resurfaces.bulkPut(data.resurfaces);
      if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings);
    }
  );
  await syncSettingsToStorage(await getSettings());
}
