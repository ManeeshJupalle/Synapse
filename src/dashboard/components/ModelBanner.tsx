import type { ModelStatus } from '../hooks/useModelStatus';

export default function ModelBanner({ status }: { status: ModelStatus }) {
  if (status === 'unknown' || status === 'ready') return null;

  const isError = status === 'error';

  return (
    <div
      className={`mb-5 card p-4 animate-fade-in ${
        isError ? 'border-synapse-danger/40' : 'border-synapse-accent/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isError ? 'bg-synapse-danger' : 'bg-synapse-accent animate-pulse'
          }`}
        />
        <div>
          <div className="text-sm font-medium">
            {isError ? 'Embedding model unavailable' : 'Loading embedding model...'}
          </div>
          <div className="text-xs text-synapse-muted mt-0.5">
            {isError
              ? 'Local model initialization failed. Rebuild the extension bundle or reload the extension before using semantic search.'
              : 'Initializing the bundled all-MiniLM-L6-v2 model on-device. Semantic search will be available shortly.'}
          </div>
        </div>
      </div>
      <div className="mt-3 h-1 bg-synapse-elevated rounded-full overflow-hidden">
        <div
          className={`h-full w-full rounded-full ${
            isError
              ? 'bg-synapse-danger/70'
              : 'bg-gradient-to-r from-synapse-accent to-synapse-accent2 animate-pulse-soft'
          }`}
        />
      </div>
    </div>
  );
}
