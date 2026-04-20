import { useRef, useState } from 'react';
import type { SearchResult } from '@shared/types';
import { formatRelative, truncate } from '@shared/utils/format';

type Mode = 'semantic' | 'keyword';

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('semantic');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch(nextQuery: string) {
    if (!nextQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'SEARCH',
        payload: { query: nextQuery.trim(), mode },
      })) as { ok: boolean; data?: SearchResult[]; error?: string } | undefined;

      if (!response) {
        setError('No response from background worker. Try reloading the extension.');
      } else if (!response.ok) {
        setError(response.error ?? 'Search failed.');
      } else {
        setResults(response.data ?? []);
        if ((response.data ?? []).length === 0) {
          setError('No results found.');
        }
      }
    } catch (error) {
      setError('Background worker unavailable. Reload the extension and try again.');
      console.error('[synapse] search error', error);
    } finally {
      setBusy(false);
    }
  }

  const placeholder =
    mode === 'semantic'
      ? 'Search by meaning - e.g. "transformer attention mechanisms"'
      : 'Exact keyword search...';

  return (
    <div className="card p-5 animate-slide-up">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              className="input pl-12"
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value) {
                  setResults([]);
                  setError(null);
                }
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-wide text-synapse-muted select-none">
              SEARCH
            </span>
          </div>

          <div className="flex items-center gap-0.5 p-1 bg-synapse-elevated border border-synapse-border rounded-lg">
            {(['semantic', 'keyword'] as Mode[]).map((nextMode) => (
              <button
                type="button"
                key={nextMode}
                onClick={() => setMode(nextMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === nextMode
                    ? 'bg-synapse-accent text-white'
                    : 'text-synapse-muted hover:text-synapse-text'
                }`}
              >
                {nextMode}
              </button>
            ))}
          </div>

          <button type="submit" className="btn-primary min-w-[80px]" disabled={busy}>
            {busy ? <Spinner /> : 'Search'}
          </button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-synapse-muted">{error}</p>}

      {results.length > 0 && (
        <div className="mt-5 space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} query={query} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  query,
  mode,
}: {
  result: SearchResult;
  query: string;
  mode: Mode;
}) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 p-3 rounded-xl border border-synapse-border hover:border-synapse-accent/50 hover:bg-synapse-elevated transition-colors"
    >
      {result.favicon && (
        <img src={result.favicon} alt="" className="w-5 h-5 rounded mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm leading-snug">
          {mode === 'keyword' ? highlight(result.title, query) : result.title}
        </div>
        <div className="text-xs text-synapse-muted mt-0.5">
          {result.domain} - {formatRelative(result.capturedAt)} -{' '}
          {result.wordCount.toLocaleString()} words
        </div>
        <div className="text-sm text-synapse-muted mt-2 leading-relaxed">
          {mode === 'keyword'
            ? highlight(truncate(result.excerpt, 200), query)
            : truncate(result.excerpt, 200)}
        </div>
        {result.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {result.keywords.slice(0, 5).map((keyword) => (
              <span key={keyword} className="chip">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="font-mono text-xs text-synapse-accent font-medium">
          {Math.round(result.score * 100)}%
        </div>
      </div>
    </a>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-synapse-accent/30 text-white rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}
