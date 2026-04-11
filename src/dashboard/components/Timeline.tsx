import { useMemo } from 'react';
import type { CapturedPage, Cluster } from '@shared/types';
import { formatDay, formatRelative, truncate } from '@shared/utils/format';

interface Props {
  pages: CapturedPage[];
  clusters: Cluster[];
}

export default function Timeline({ pages, clusters }: Props) {
  const clusterMap = useMemo(() => new Map(clusters.map((c) => [c.id as number, c])), [clusters]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, CapturedPage[]>();
    for (const p of pages) {
      const key = new Date(p.capturedAt).toDateString();
      const arr = byDay.get(key) ?? [];
      arr.push(p);
      byDay.set(key, arr);
    }
    return [...byDay.entries()]
      .map(([k, v]) => ({ key: k, ts: new Date(k).getTime(), pages: v }))
      .sort((a, b) => b.ts - a.ts);
  }, [pages]);

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Timeline</h2>
      <div className="space-y-8 max-h-[720px] overflow-y-auto pr-2">
        {grouped.map((day) => (
          <section key={day.key}>
            <div className="sticky top-0 bg-synapse-surface/95 backdrop-blur py-2 z-10">
              <h3 className="text-sm font-semibold text-synapse-muted uppercase tracking-wider">
                {formatDay(day.ts)} · {day.pages.length}
              </h3>
            </div>
            <ul className="mt-3 space-y-2">
              {day.pages.map((p) => {
                const cluster = p.clusterId != null ? clusterMap.get(p.clusterId) : null;
                return (
                  <li key={p.id}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg border border-synapse-border hover:border-synapse-accent/60 hover:bg-synapse-elevated transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                        style={{ background: cluster?.color ?? '#5a5a72' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {p.favicon && <img src={p.favicon} alt="" className="w-4 h-4 rounded-sm" />}
                          <div className="font-medium truncate">{p.title}</div>
                        </div>
                        <div className="text-xs text-synapse-muted mt-1">
                          {p.domain} · {formatRelative(p.capturedAt)} · {p.wordCount} words
                        </div>
                        <div className="text-sm text-synapse-muted mt-2">{truncate(p.excerpt, 180)}</div>
                      </div>
                      {cluster && (
                        <span
                          className="chip whitespace-nowrap"
                          style={{ borderColor: cluster.color + '40', color: cluster.color }}
                        >
                          {cluster.label}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
