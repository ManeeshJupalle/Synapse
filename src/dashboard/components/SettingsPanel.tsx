import { useRef, useState } from 'react';
import { updateSettings } from '@shared/db';
import type { Settings } from '@shared/types';

interface Props {
  settings: Settings;
  onChanged: () => void;
}

export default function SettingsPanel({ settings, onChanged }: Props) {
  const [local, setLocal] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  }

  async function save() {
    setSaving(true);
    try {
      await updateSettings(local);
      flash('Saved');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function send(type: string, payload?: unknown) {
    return chrome.runtime.sendMessage({ type, payload });
  }

  async function handleExport() {
    const res = await send('EXPORT_DATA');
    if (res?.ok) {
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synapse-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await send('IMPORT_DATA', text);
    onChanged();
    flash('Imported');
  }

  async function handleDelete() {
    if (!confirm('Delete ALL Synapse data? This cannot be undone.')) return;
    await send('DELETE_ALL');
    onChanged();
  }

  async function handleReindex() {
    flash('Reindexing… this may take a minute');
    await send('REINDEX');
    flash('Reindex complete');
    onChanged();
  }

  function addDomain(raw: string) {
    const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!domain || local.blockedDomains.includes(domain)) return;
    setLocal({ ...local, blockedDomains: [...local.blockedDomains, domain] });
  }

  function removeDomain(domain: string) {
    setLocal({ ...local, blockedDomains: local.blockedDomains.filter((d) => d !== domain) });
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 animate-slide-up">

      {/* Capture */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Capture</h3>
        <div className="space-y-4">
          <Toggle
            label="Capture enabled"
            value={local.captureEnabled}
            onChange={(v) => setLocal({ ...local, captureEnabled: v })}
          />
          <NumberField
            label="Dwell threshold (seconds)"
            value={Math.round(local.dwellThresholdMs / 1000)}
            min={5} max={120}
            onChange={(v) => setLocal({ ...local, dwellThresholdMs: v * 1000 })}
          />
          <NumberField
            label="Minimum word count"
            value={local.minWordCount}
            min={50} max={1000} step={10}
            onChange={(v) => setLocal({ ...local, minWordCount: v })}
          />
        </div>
      </div>

      {/* Graph */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Graph & Clustering</h3>
        <div className="space-y-4">
          <SliderField
            label="Connection threshold"
            value={local.connectionThreshold}
            onChange={(v) => setLocal({ ...local, connectionThreshold: v })}
          />
          <SliderField
            label="Cluster threshold"
            value={local.clusterThreshold}
            onChange={(v) => setLocal({ ...local, clusterThreshold: v })}
          />
          <SliderField
            label="Resurface similarity"
            value={local.similarityThreshold}
            onChange={(v) => setLocal({ ...local, similarityThreshold: v })}
          />
        </div>
      </div>

      {/* Resurface */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Resurface</h3>
        <div className="space-y-4">
          <Toggle
            label="Resurface forgotten pages"
            value={local.resurfaceEnabled}
            onChange={(v) => setLocal({ ...local, resurfaceEnabled: v })}
          />
          <NumberField
            label="Cooldown (hours)"
            value={Math.round(local.resurfaceCooldownMs / 3_600_000)}
            min={1} max={168}
            onChange={(v) => setLocal({ ...local, resurfaceCooldownMs: v * 3_600_000 })}
          />
        </div>
      </div>

      {/* Blocked Domains */}
      <div className="card p-6">
        <h3 className="font-semibold mb-1">Blocked Domains</h3>
        <p className="text-xs text-synapse-muted mb-4">
          Pages from these domains are never captured. Subdomains are automatically blocked too.
        </p>

        {/* Tag list */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
          {local.blockedDomains.map((d) => (
            <span key={d} className="chip flex items-center gap-1.5">
              {d}
              <button
                type="button"
                onClick={() => removeDomain(d)}
                className="text-synapse-muted hover:text-synapse-danger leading-none"
                aria-label={`Remove ${d}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Add input */}
        <div className="flex gap-2">
          <input
            ref={domainInputRef}
            type="text"
            className="input flex-1 text-sm"
            placeholder="example.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDomain(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => {
              if (domainInputRef.current) {
                addDomain(domainInputRef.current.value);
                domainInputRef.current.value = '';
                domainInputRef.current.focus();
              }
            }}
          >
            Add
          </button>
        </div>
        <p className="text-xs text-synapse-muted mt-2">Press Enter or click Add</p>
      </div>

      {/* Data */}
      <div className="card p-6 md:col-span-2">
        <h3 className="font-semibold mb-4">Data</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={handleExport}>Export JSON</button>
          <label className="btn-ghost cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <button className="btn-ghost" onClick={handleReindex}>Reindex all pages</button>
          <button className="btn-danger" onClick={handleDelete}>Delete all data</button>
        </div>
        <p className="text-xs text-synapse-muted mt-4">
          All data lives in IndexedDB on this device only. Export regularly if you want backups.
        </p>
      </div>

      {/* Save */}
      <div className="md:col-span-2 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {status && <span className="text-sm text-synapse-accent2 animate-fade-in">{status}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-synapse-accent' : 'bg-synapse-elevated border border-synapse-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        className="input mt-1"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function SliderField({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono text-synapse-accent">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className="w-full accent-synapse-accent"
        min={0.3} max={0.95} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-xs text-synapse-muted mt-0.5">
        <span>0.30 loose</span>
        <span>0.95 strict</span>
      </div>
    </label>
  );
}
