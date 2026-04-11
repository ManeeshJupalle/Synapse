interface Props {
  stats: { pages: number; clusters: number; connections: number; domains: number };
}

export default function StatsBar({ stats }: Props) {
  const items = [
    { label: 'Pages', value: stats.pages, accent: 'text-synapse-accent' },
    { label: 'Clusters', value: stats.clusters, accent: 'text-synapse-accent2' },
    { label: 'Connections', value: stats.connections, accent: 'text-amber-400' },
    { label: 'Domains', value: stats.domains, accent: 'text-rose-300' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
      {items.map((i) => (
        <div key={i.label} className="card card-hover p-5">
          <div className={`text-3xl font-bold ${i.accent}`}>{i.value.toLocaleString()}</div>
          <div className="text-xs uppercase tracking-wider text-synapse-muted mt-1">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
