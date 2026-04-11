import type { ModelStatus } from '../hooks/useModelStatus';

export default function ModelBanner({ status }: { status: ModelStatus }) {
  if (status === 'unknown' || status === 'ready') return null;

  return (
    <div className="mb-5 card p-4 border-synapse-accent/30 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-synapse-accent animate-pulse flex-shrink-0" />
        <div>
          <div className="text-sm font-medium">Loading embedding model…</div>
          <div className="text-xs text-synapse-muted mt-0.5">
            Downloading all-MiniLM-L6-v2 (~30 MB). Cached locally after this — won't happen again.
            Semantic search will be available shortly.
          </div>
        </div>
      </div>
      <div className="mt-3 h-1 bg-synapse-elevated rounded-full overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-synapse-accent to-synapse-accent2 rounded-full animate-pulse-soft" />
      </div>
    </div>
  );
}
