import { useEffect, useState } from 'react';

export type ModelStatus = 'unknown' | 'loading' | 'ready';

export function useModelStatus(): ModelStatus {
  const [status, setStatus] = useState<ModelStatus>('unknown');

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }) as
          | { ok: boolean; data?: { modelReady?: boolean } }
          | undefined;
        if (cancelled) return;
        if (res?.ok) {
          setStatus(res.data?.modelReady ? 'ready' : 'loading');
        }
      } catch {
        if (!cancelled) setStatus('loading');
      }
    }

    void poll();
    const id = setInterval(() => void poll(), 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return status;
}
