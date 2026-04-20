import { useMemo } from 'react';
import type { CapturedPage, Cluster } from '@shared/types';
import { formatRelative, truncate } from '@shared/utils/format';

interface Props {
  clusters: Cluster[];
  pages: CapturedPage[];
}

export default function ClusterPanel({ clusters, pages }: Props) {
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id as number, page])), [pages]);
  const sorted = useMemo(
    () => [...clusters].sort((left, right) => right.pageIds.length - left.pageIds.length),
    [clusters]
  );

  if (sorted.length === 0) {
    return (
      <div className="card p-12 text-center text-synapse-muted animate-slide-up">
        No clusters yet. Capture a few more pages and Synapse will auto-group them.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 animate-slide-up">
      {sorted.map((cluster) => {
        const clusterPages = cluster.pageIds
          .map((pageId) => pageMap.get(pageId))
          .filter(Boolean) as CapturedPage[];

        return (
          <div key={cluster.id} className="card p-5 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: cluster.color, boxShadow: `0 0 20px ${cluster.color}` }}
                />
                <h3 className="font-semibold text-lg">{cluster.label}</h3>
              </div>
              <span className="chip">{cluster.pageIds.length} pages</span>
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              {cluster.keywords.map((keyword) => (
                <span key={keyword} className="chip">
                  {keyword}
                </span>
              ))}
            </div>

            <ul className="mt-4 space-y-1 max-h-48 overflow-y-auto">
              {clusterPages.slice(0, 10).map((page) => (
                <li key={page.id}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm text-synapse-muted hover:text-synapse-accent truncate"
                    title={page.title}
                  >
                    - {truncate(page.title, 64)}
                    <span className="text-synapse-border ml-2">
                      {formatRelative(page.capturedAt)}
                    </span>
                  </a>
                </li>
              ))}

              {clusterPages.length > 10 && (
                <li className="text-xs text-synapse-muted">+ {clusterPages.length - 10} more</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
