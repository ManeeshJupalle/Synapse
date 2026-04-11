import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import type { CapturedPage, Cluster, Connection } from '@shared/types';
import { formatRelative, truncate } from '@shared/utils/format';

interface Props {
  pages: CapturedPage[];
  clusters: Cluster[];
  connections: Connection[];
}

type Node = {
  id: number;
  name: string;
  val: number;
  color: string;
  page: CapturedPage;
  x?: number;
  y?: number;
};

type Link = {
  source: number;
  target: number;
  similarity: number;
};

export default function KnowledgeGraph({ pages, clusters, connections }: Props) {
  const fgRef = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [selected, setSelected] = useState<CapturedPage | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ width: e.contentRect.width, height: 560 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const clusterColorMap = new Map(clusters.map((c) => [c.id as number, c.color]));
    const nodes: Node[] = pages
      .filter((p) => p.id != null)
      .map((p) => ({
        id: p.id as number,
        name: p.title,
        val: Math.min(20, 3 + Math.log2(1 + p.wordCount / 200)),
        color: (p.clusterId && clusterColorMap.get(p.clusterId)) || '#5a5a72',
        page: p,
      }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: Link[] = connections
      .filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId))
      .map((c) => ({ source: c.sourceId, target: c.targetId, similarity: c.similarity }));
    return { nodes, links };
  }, [pages, clusters, connections]);

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Knowledge Graph</h2>
        <div className="text-xs text-synapse-muted">
          {data.nodes.length} nodes · {data.links.length} edges
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative rounded-xl overflow-hidden border border-synapse-border bg-synapse-bg"
        style={{ height: 560 }}
      >
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data}
          nodeRelSize={4}
          backgroundColor="#0a0a0f"
          linkColor={() => 'rgba(124, 92, 255, 0.18)'}
          linkWidth={(l: Link) => 0.5 + l.similarity * 1.5}
          nodeCanvasObject={(node, ctx, scale) => {
            const n = node as Node;
            const r = n.val;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = n.color;
            ctx.fill();
            if (scale > 1.2) {
              ctx.font = `${10 / scale}px Inter, system-ui`;
              ctx.fillStyle = '#e8e8f0';
              ctx.textAlign = 'center';
              ctx.fillText(truncate(n.name, 26), n.x ?? 0, (n.y ?? 0) + r + 10 / scale);
            }
          }}
          onNodeClick={(node) => setSelected((node as Node).page)}
          cooldownTicks={100}
        />
        {selected && (
          <div className="absolute top-4 right-4 w-80 card p-4 animate-slide-up">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {selected.favicon && (
                  <img src={selected.favicon} alt="" className="w-4 h-4 rounded-sm" />
                )}
                <div className="font-medium truncate">{selected.title}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-synapse-muted hover:text-synapse-text"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-synapse-muted mt-1">
              {selected.domain} · {formatRelative(selected.capturedAt)}
            </div>
            <p className="text-sm text-synapse-muted mt-3">{truncate(selected.excerpt, 200)}</p>
            {selected.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {selected.keywords.slice(0, 5).map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </div>
            )}
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-4 w-full justify-center"
            >
              Open page ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
