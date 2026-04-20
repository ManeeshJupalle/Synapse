import { useEffect, useMemo, useState } from 'react';
import { db, getSettings } from '@shared/db';
import type { CapturedPage, Cluster, Connection, Settings } from '@shared/types';
import StatsBar from './components/StatsBar';
import SearchPanel from './components/SearchPanel';
import KnowledgeGraph from './components/KnowledgeGraph';
import Timeline from './components/Timeline';
import ClusterPanel from './components/ClusterPanel';
import SettingsPanel from './components/SettingsPanel';
import ModelBanner from './components/ModelBanner';
import { useModelStatus } from './hooks/useModelStatus';
import type { ModelStatus } from './hooks/useModelStatus';
import Onboarding from './components/Onboarding';

type View = 'graph' | 'timeline' | 'clusters' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('graph');
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem('synapse_onboarded') === 'true'
  );
  const modelStatus: ModelStatus = useModelStatus();

  async function refresh() {
    const [nextPages, nextClusters, nextConnections, nextSettings] = await Promise.all([
      db.pages.orderBy('capturedAt').reverse().toArray(),
      db.clusters.toArray(),
      db.connections.toArray(),
      getSettings(),
    ]);

    setPages(nextPages);
    setClusters(nextClusters);
    setConnections(nextConnections);
    setSettings(nextSettings);
    setLoading(false);

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response?.ok) {
        setPendingJobs(response.data?.pendingJobs ?? 0);
      }
    } catch {
      // The service worker may be cold. The next refresh will pick it up.
    }
  }

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(intervalId);
  }, []);

  const stats = useMemo(
    () => ({
      pages: pages.length,
      clusters: clusters.length,
      connections: connections.length,
      domains: new Set(pages.map((page) => page.domain)).size,
    }),
    [pages, clusters, connections]
  );

  return (
    <div className="min-h-screen noise">
      {!onboarded && pages.length === 0 && !loading ? (
        <Onboarding
          onDone={() => {
            localStorage.setItem('synapse_onboarded', 'true');
            setOnboarded(true);
          }}
        />
      ) : (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <Header view={view} onView={setView} pendingJobs={pendingJobs} />

          <ModelBanner status={modelStatus} />

          <StatsBar stats={stats} />

          {loading ? (
            <LoadingState />
          ) : pages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-6">
              <SearchPanel />
              <div className="mt-8">
                {view === 'graph' && (
                  <KnowledgeGraph pages={pages} clusters={clusters} connections={connections} />
                )}
                {view === 'timeline' && <Timeline pages={pages} clusters={clusters} />}
                {view === 'clusters' && <ClusterPanel clusters={clusters} pages={pages} />}
                {view === 'settings' && settings && (
                  <SettingsPanel settings={settings} onChanged={refresh} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header({
  view,
  onView,
  pendingJobs,
}: {
  view: View;
  onView: (view: View) => void;
  pendingJobs: number;
}) {
  const tabs: { id: View; label: string }[] = [
    { id: 'graph', label: 'Graph' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'clusters', label: 'Clusters' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="flex items-center justify-between mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-synapse-accent to-synapse-accent2 glow flex items-center justify-center text-xl font-semibold">
          S
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Synapse</h1>
          <p className="text-xs text-synapse-muted">Your second brain - 100% local</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {pendingJobs > 0 && (
          <div className="flex items-center gap-2 text-xs text-synapse-muted animate-pulse-soft">
            <span className="w-2 h-2 rounded-full bg-synapse-accent2 animate-pulse" />
            Embedding {pendingJobs} page{pendingJobs !== 1 ? 's' : ''}...
          </div>
        )}
        <nav className="flex items-center gap-1 p-1 bg-synapse-surface border border-synapse-border rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onView(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === tab.id
                  ? 'bg-synapse-accent text-white'
                  : 'text-synapse-muted hover:text-synapse-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="card p-12 mt-6 text-center text-synapse-muted animate-pulse-soft">
      Loading your knowledge graph...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-16 mt-6 text-center animate-slide-up">
      <div className="text-6xl mb-4 font-semibold">S</div>
      <h2 className="text-2xl font-semibold mb-2">Your brain is empty - for now.</h2>
      <p className="text-synapse-muted max-w-md mx-auto mb-6">
        Synapse captures articles after you spend about 15 seconds reading them. Visit a few
        long-form pages and come back here.
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-xs text-synapse-muted">
        <span className="chip">No API calls</span>
        <span className="chip">No telemetry</span>
        <span className="chip">All on-device</span>
        <span className="chip">15s dwell threshold</span>
      </div>
      <p className="text-xs text-synapse-muted mt-8">
        Blocked domains will not be captured. Check Settings to customize.
      </p>
    </div>
  );
}
