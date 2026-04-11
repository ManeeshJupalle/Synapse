import { useMemo, useState } from 'react';
import type { CapturedPage } from '@shared/types';
import { embed, cosineSimilarity } from '@shared/embeddings';
import { formatRelative, truncate } from '@shared/utils/format';

interface Props {
  pages: CapturedPage[];
}

type Mode = 'semantic' | 'keyword';

export default function SearchPanel({ pages }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('semantic');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ page: CapturedPage; score: number }[]>([]);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'semantic') {
        const vec = await embed(q);
        const scored = pages
          .filter((p) => p.embedding?.length)
          .map((p) => ({ page: p, score: cosineSimilarity(vec, p.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        setResults(scored);
      } else {
        const needle = q.toLowerCase();
        const scored = pages
          .map((p) => {
            const t = (p.title + ' ' + p.excerpt + ' ' + p.content).toLowerCase();
            const i = t.indexOf(needle);
            return { page: p, score: i === -1 ? 0 : 1 / (i + 1) };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        setResults(scored);
      }
    } finally {
      setBusy(false);
    }
  }

  const placeholder = useMemo(
    () =>
      mode === 'semantic'
        ? 'Search by meaning — e.g. "the attention mechanism"'
        : 'Exact keyword search…',
    [mode]
  );

  return (
    <div className="card p-5 animate-slide-up">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query);
        }}
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              className="input pl-10"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-synapse-muted">🔍</div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-synapse-elevated border border-synapse-border rounded-lg">
            {(['semantic', 'keyword'] as Mode[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === m ? 'bg-synapse-accent text-white' : 'text-synapse-muted'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '…' : 'Search'}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="mt-5 space-y-2 max-h-[360px] overflow-y-auto pr-2">
          {results.map(({ page, score }) => (
            <a
              key={page.id}
              href={page.url}
              target="_blank"
              rel="noreferrer"
              className="block p-3 rounded-lg border border-synapse-border hover:border-synapse-accent/60 hover:bg-synapse-elevated transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {page.favicon && (
                      <img src={page.favicon} alt="" className="w-4 h-4 rounded-sm" />
                    )}
                    <div className="font-medium truncate">{page.title}</div>
                  </div>
                  <div className="text-xs text-synapse-muted mt-1">
                    {page.domain} · {formatRelative(page.capturedAt)}
                  </div>
                  <div className="text-sm text-synapse-muted mt-2">{truncate(page.excerpt, 180)}</div>
                </div>
                <div className="text-xs font-mono text-synapse-accent whitespace-nowrap">
                  {Math.round(score * 100)}%
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
