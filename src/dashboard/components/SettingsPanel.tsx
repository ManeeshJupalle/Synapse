import { useState } from 'react';
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

  async function save() {
    setSaving(true);
    try {
      await updateSettings(local);
      setStatus('Saved');
      onChanged();
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function send(type: string, payload?: unknown) {
    const res = await chrome.runtime.sendMessage({ type, payload });
    return res;
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
    setStatus('Imported');
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleDelete() {
    if (!confirm('Delete ALL Synapse data? This cannot be undone.')) return;
    await send('DELETE_ALL');
    onChanged();
  }

  async function handleReindex() {
    setStatus('Reindexing… this may take a moment');
    await send('REINDEX');
    setStatus('Reindex complete');
    onChanged();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 animate-slide-up">
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
            min={5}
            max={120}
            onChange={(v) => setLocal({ ...local, dwellThresholdMs: v * 1000 })}
          />
          <NumberField
            label="Minimum word count"
            value={local.minWordCount}
            min={50}
            max={1000}
            step={10}
            onChange={(v) => setLocal({ ...local, minWordCount: v })}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-4">Graph & clustering</h3>
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
            label="Similarity threshold"
            value={local.similarityThreshold}
            onChange={(v) => setLocal({ ...local, similarityThreshold: v })}
          />
        </div>
      </div>

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
            min={1}
            max={168}
            onChange={(v) => setLocal({ ...local, resurfaceCooldownMs: v * 3_600_000 })}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-4">Data</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={handleExport}>
            Export JSON
          </button>
          <label className="btn-ghost cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <button className="btn-ghost" onClick={handleReindex}>
            Reindex all
          </button>
          <button className="btn-danger" onClick={handleDelete}>
            Delete all data
          </button>
        </div>
        <p className="text-xs text-synapse-muted mt-4">
          All data lives in IndexedDB on this device. Export regularly if you want backups.
        </p>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {status && <span className="text-sm text-synapse-accent2">{status}</span>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          value ? 'bg-synapse-accent' : 'bg-synapse-elevated'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        className="input mt-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-synapse-accent">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className="w-full mt-1 accent-synapse-accent"
        min={0.3}
        max={0.9}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
