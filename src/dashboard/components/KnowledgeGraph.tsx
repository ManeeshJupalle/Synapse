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

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: 560 });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    const colorMap = new Map<number, string>(clusters.map((cluster) => [cluster.id as number, cluster.color]));

    const nodes: GNode[] = pages
      .filter((page) => page.id != null)
      .map((page) => {
        const clusterColor = page.clusterId != null ? colorMap.get(page.clusterId as number) : undefined;
        return {
          id: page.id as number,
          name: page.title,
          val: Math.min(18, 4 + Math.log2(1 + page.wordCount / 250)),
          color: clusterColor ?? '#4a4a62',
          clustered: clusterColor != null,
          page,
        };
      });

    const nodeIds = new Set(nodes.map((node) => node.id));
    const links: GLink[] = connections
      .filter((connection) => nodeIds.has(connection.sourceId) && nodeIds.has(connection.targetId))
      .map((connection) => ({
        source: connection.sourceId,
        target: connection.targetId,
        similarity: connection.similarity,
      }));

    return { nodes, links };
  }, [pages, clusters, connections]);

  useEffect(() => {
    if (data.nodes.length === 0) return;

    const timeoutId = setTimeout(() => fgRef.current?.zoomToFit(600, 60), 900);
    return () => clearTimeout(timeoutId);
  }, [data.nodes.length]);

  const drawNode = useCallback(
    (node: unknown, context: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GNode;
      const x = graphNode.x ?? 0;
      const y = graphNode.y ?? 0;
      const radius = graphNode.val;
      const isHovered = graphNode.id === hoveredId;
      const isSelected = selected != null && graphNode.id === selected.id;

      if (graphNode.clustered || isHovered) {
        context.shadowColor = graphNode.color;
        context.shadowBlur = isHovered ? 22 : 10;
      }

      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = graphNode.color;
      context.fill();
      context.shadowBlur = 0;

      if (isSelected) {
        context.beginPath();
        context.arc(x, y, radius + 4 / globalScale, 0, 2 * Math.PI);
        context.strokeStyle = 'rgba(255,255,255,0.6)';
        context.lineWidth = 1.5 / globalScale;
        context.stroke();
      }

      if (isHovered || globalScale > 1.4) {
        const label =
          graphNode.name.length > 32 ? graphNode.name.slice(0, 32) + '...' : graphNode.name;
        const fontSize = Math.max(7, Math.min(11, 9 / globalScale));
        context.font = `${fontSize}px Inter, system-ui, sans-serif`;
        context.fillStyle = isHovered ? '#ffffff' : 'rgba(200,200,220,0.85)';
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.fillText(label, x, y + radius + 3 / globalScale);
      }
    },
    [hoveredId, selected]
  );

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Knowledge Graph</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-synapse-muted">
            {data.nodes.length} nodes - {data.links.length} edges
          </span>
          <div className="flex items-center gap-0.5 p-1 bg-synapse-elevated border border-synapse-border rounded-lg">
            <button
              onClick={() => fgRef.current?.zoom(currentZoom / 1.4, 250)}
              className="w-7 h-7 flex items-center justify-center text-synapse-muted hover:text-synapse-text rounded text-base leading-none"
              title="Zoom out"
            >
              -
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
          linkWidth={(link: GLink) => 0.8 + link.similarity * 2.5}
          nodeCanvasObject={drawNode}
          onNodeClick={(node) => setSelected((node as GNode).page)}
          onNodeHover={(node) => setHoveredId(node ? (node as GNode).id : null)}
          onZoom={({ k }) => setCurrentZoom(k)}
          cooldownTicks={150}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.25}
        />

        <div className="absolute top-3 left-3 text-xs text-synapse-muted/50 pointer-events-none select-none">
          scroll to zoom - drag to pan - click node to inspect
        </div>

        {clusters.length > 0 && (
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-none">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: cluster.color, boxShadow: `0 0 8px ${cluster.color}` }}
                />
                <span className="text-synapse-muted bg-black/50 px-1.5 py-0.5 rounded">
                  {cluster.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {selected && <NodeDetail page={selected} onClose={() => setSelected(null)} />}
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
          x
        </button>
      </div>

      <div className="text-xs text-synapse-muted mt-1.5">
        {page.domain} - {formatRelative(page.capturedAt)} - {page.wordCount.toLocaleString()} words
      </div>

      <p className="text-sm text-synapse-muted mt-3 leading-relaxed">
        {truncate(page.excerpt, 200)}
      </p>

      {page.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {page.keywords.slice(0, 6).map((keyword) => (
            <span key={keyword} className="chip">
              {keyword}
            </span>
          ))}
        </div>
      )}

      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        className="btn-primary mt-4 w-full justify-center text-sm"
      >
        Open page -&gt;
      </a>
    </div>
  );
}
