import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { CapturedPage, Cluster, Connection } from '@shared/types';
import { formatRelative, truncate } from '@shared/utils/format';

interface Props {
  pages: CapturedPage[];
  clusters: Cluster[];
  connections: Connection[];
}

type GNode = {
  id: number;
  name: string;
  val: number;
  color: string;
  clustered: boolean;
  page: CapturedPage;
  x?: number;
  y?: number;
};

type GLink = {
  source: number;
  target: number;
  similarity: number;
};

export default function KnowledgeGraph({ pages, clusters, connections }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [selected, setSelected] = useState<CapturedPage | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Track container width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ width: e.contentRect.width, height: 560 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    // Build color map from cluster id → color
    const colorMap = new Map<number, string>(
      clusters.map((c) => [c.id as number, c.color])
    );

    const nodes: GNode[] = pages
      .filter((p) => p.id != null)
      .map((p) => {
        const clr =
          p.clusterId != null && p.clusterId !== undefined
            ? colorMap.get(p.clusterId as number)
            : undefined;
        return {
          id: p.id as number,
          name: p.title,
          val: Math.min(18, 4 + Math.log2(1 + p.wordCount / 250)),
          color: clr ?? '#4a4a62',
          clustered: clr != null,
          page: p,
        };
      });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GLink[] = connections
      .filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId))
      .map((c) => ({ source: c.sourceId, target: c.targetId, similarity: c.similarity }));

    return { nodes, links };
  }, [pages, clusters, connections]);

  // Auto-fit when the graph first populates or node count changes
  useEffect(() => {
    if (data.nodes.length === 0) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 60), 900);
    return () => clearTimeout(t);
  }, [data.nodes.length]);

  const drawNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const r = n.val;
      const isHovered = n.id === hoveredId;
      const isSelected = selected != null && n.id === selected.id;

      // Glow for clustered / hovered nodes
      if (n.clustered || isHovered) {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = isHovered ? 22 : 10;
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Label: always when hovered, or when zoomed in past 1.4×
      if (isHovered || globalScale > 1.4) {
        const label = n.name.length > 32 ? n.name.slice(0, 32) + '…' : n.name;
        const fontSize = Math.max(7, Math.min(11, 9 / globalScale));
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(200,200,220,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, y + r + 3 / globalScale);
      }
    },
    [hoveredId, selected]
  );

  return (
    <div className="card p-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Knowledge Graph</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-synapse-muted">
            {data.nodes.length} nodes · {data.links.length} edges
          </span>
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 p-1 bg-synapse-elevated border border-synapse-border rounded-lg">
            <button
              onClick={() => fgRef.current?.zoom(currentZoom / 1.4, 250)}
              className="w-7 h-7 flex items-center justify-center text-synapse-muted hover:text-synapse-text rounded text-base leading-none"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => fgRef.current?.zoomToFit(400, 60)}
              className="px-2 h-7 text-xs text-synapse-muted hover:text-synapse-text"
              title="Fit all nodes"
            >
              fit
            </button>
            <button
              onClick={() => fgRef.current?.zoom(currentZoom * 1.4, 250)}
              className="w-7 h-7 flex items-center justify-center text-synapse-muted hover:text-synapse-text rounded text-base leading-none"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
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
          linkColor={() => 'rgba(124,92,255,0.22)'}
          linkWidth={(l: GLink) => 0.8 + l.similarity * 2.5}
          nodeCanvasObject={drawNode}
          onNodeClick={(node) => setSelected((node as GNode).page)}
          onNodeHover={(node) => setHoveredId(node ? (node as GNode).id : null)}
          onZoom={({ k }) => setCurrentZoom(k)}
          cooldownTicks={150}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.25}
        />

        {/* Hint overlay */}
        <div className="absolute top-3 left-3 text-xs text-synapse-muted/50 pointer-events-none select-none">
          scroll to zoom · drag to pan · click node to inspect
        </div>

        {/* Cluster legend */}
        {clusters.length > 0 && (
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-none">
            {clusters.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
                />
                <span className="text-synapse-muted bg-black/50 px-1.5 py-0.5 rounded">
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Selected node detail panel */}
        {selected && (
          <NodeDetail page={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

function NodeDetail({ page, onClose }: { page: CapturedPage; onClose: () => void }) {
  return (
    <div className="absolute top-4 right-4 w-80 card p-4 animate-slide-up z-10">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {page.favicon && (
            <img src={page.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
          )}
          <div className="font-medium text-sm leading-snug">{page.title}</div>
        </div>
        <button
          onClick={onClose}
          className="text-synapse-muted hover:text-synapse-text flex-shrink-0 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="text-xs text-synapse-muted mt-1.5">
        {page.domain} · {formatRelative(page.capturedAt)} · {page.wordCount.toLocaleString()} words
      </div>

      <p className="text-sm text-synapse-muted mt-3 leading-relaxed">
        {truncate(page.excerpt, 200)}
      </p>

      {page.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {page.keywords.slice(0, 6).map((k) => (
            <span key={k} className="chip">{k}</span>
          ))}
        </div>
      )}

      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        className="btn-primary mt-4 w-full justify-center text-sm"
      >
        Open page ↗
      </a>
    </div>
  );
}
