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

  function flash(message: string) {
    setStatus(message);
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
    const response = await send('EXPORT_DATA');
    if (response?.ok) {
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `synapse-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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
    flash('Reindexing... this may take a minute');
    await send('REINDEX');
    flash('Reindex complete');
    onChanged();
  }

  function addDomain(raw: string) {
    const domain = raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    if (!domain || local.blockedDomains.includes(domain)) return;

    setLocal({ ...local, blockedDomains: [...local.blockedDomains, domain] });
  }

  function removeDomain(domain: string) {
    setLocal({
      ...local,
      blockedDomains: local.blockedDomains.filter((blockedDomain) => blockedDomain !== domain),
    });
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 animate-slide-up">
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Capture</h3>
        <div className="space-y-4">
          <Toggle
            label="Capture enabled"
            value={local.captureEnabled}
            onChange={(value) => setLocal({ ...local, captureEnabled: value })}
          />
          <NumberField
            label="Dwell threshold (seconds)"
            value={Math.round(local.dwellThresholdMs / 1000)}
            min={5}
            max={120}
            onChange={(value) => setLocal({ ...local, dwellThresholdMs: value * 1000 })}
          />
          <NumberField
            label="Minimum word count"
            value={local.minWordCount}
            min={50}
            max={1000}
            step={10}
            onChange={(value) => setLocal({ ...local, minWordCount: value })}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-4">Graph and Clustering</h3>
        <div className="space-y-4">
          <SliderField
            label="Connection threshold"
            value={local.connectionThreshold}
            onChange={(value) => setLocal({ ...local, connectionThreshold: value })}
          />
          <SliderField
            label="Cluster threshold"
            value={local.clusterThreshold}
            onChange={(value) => setLocal({ ...local, clusterThreshold: value })}
          />
          <SliderField
            label="Resurface similarity"
            value={local.similarityThreshold}
            onChange={(value) => setLocal({ ...local, similarityThreshold: value })}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-4">Resurface</h3>
        <div className="space-y-4">
          <Toggle
            label="Resurface forgotten pages"
            value={local.resurfaceEnabled}
            onChange={(value) => setLocal({ ...local, resurfaceEnabled: value })}
          />
          <NumberField
            label="Cooldown (hours)"
            value={Math.round(local.resurfaceCooldownMs / 3_600_000)}
            min={1}
            max={168}
            onChange={(value) => setLocal({ ...local, resurfaceCooldownMs: value * 3_600_000 })}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-1">Blocked Domains</h3>
        <p className="text-xs text-synapse-muted mb-4">
          Pages from these domains are never captured. Subdomains are automatically blocked too.
        </p>

        <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
          {local.blockedDomains.map((domain) => (
            <span key={domain} className="chip flex items-center gap-1.5">
              {domain}
              <button
                type="button"
                onClick={() => removeDomain(domain)}
                className="text-synapse-muted hover:text-synapse-danger leading-none"
                aria-label={`Remove ${domain}`}
              >
                x
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            ref={domainInputRef}
            type="text"
            className="input flex-1 text-sm"
            placeholder="example.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addDomain(event.currentTarget.value);
                event.currentTarget.value = '';
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

      <div className="card p-6 md:col-span-2">
        <h3 className="font-semibold mb-4">Data</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={handleExport}>
            Export JSON
          </button>
          <label className="btn-ghost cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <button className="btn-ghost" onClick={handleReindex}>
            Reindex all pages
          </button>
          <button className="btn-danger" onClick={handleDelete}>
            Delete all data
          </button>
        </div>
        <p className="text-xs text-synapse-muted mt-4">
          All data lives in IndexedDB on this device only. Export regularly if you want backups.
        </p>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {status && <span className="text-sm text-synapse-accent2 animate-fade-in">{status}</span>}
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
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          value
            ? 'bg-synapse-accent'
            : 'bg-synapse-elevated border border-synapse-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
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
  onChange: (value: number) => void;
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
        onChange={(event) => onChange(Number(event.target.value))}
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
  onChange: (value: number) => void;
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
        min={0.3}
        max={0.95}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="flex justify-between text-xs text-synapse-muted mt-0.5">
        <span>0.30 loose</span>
        <span>0.95 strict</span>
      </div>
    </label>
  );
}
