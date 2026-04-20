import { Readability } from '@mozilla/readability';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type BgMessage,
  type Settings,
} from '@shared/types';
import { hashUrl } from '@shared/utils/hash';

type RuntimeSettings = Pick<
  Settings,
  'captureEnabled' | 'resurfaceEnabled' | 'dwellThresholdMs' | 'minWordCount' | 'blockedDomains'
>;

const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  captureEnabled: DEFAULT_SETTINGS.captureEnabled,
  resurfaceEnabled: DEFAULT_SETTINGS.resurfaceEnabled,
  dwellThresholdMs: DEFAULT_SETTINGS.dwellThresholdMs,
  minWordCount: DEFAULT_SETTINGS.minWordCount,
  blockedDomains: DEFAULT_SETTINGS.blockedDomains,
};

let captured = false;
let isVisible = !document.hidden;
let visibleMs = 0;
let lastVisibilityChange = Date.now();
let currentUrlHash = hashUrl(location.href);
let runtimeSettings: RuntimeSettings = { ...DEFAULT_RUNTIME_SETTINGS };

async function loadRuntimeSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    runtimeSettings = {
      ...DEFAULT_RUNTIME_SETTINGS,
      ...(stored[SETTINGS_STORAGE_KEY] as Partial<RuntimeSettings> | undefined),
    };
  } catch {
    runtimeSettings = { ...DEFAULT_RUNTIME_SETTINGS };
  }
}

function watchRuntimeSettings() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const next = changes[SETTINGS_STORAGE_KEY]?.newValue as Partial<RuntimeSettings> | undefined;
    if (!next) return;

    runtimeSettings = { ...DEFAULT_RUNTIME_SETTINGS, ...next };
  });
}

function accumulateVisible() {
  const now = Date.now();
  if (isVisible) visibleMs += now - lastVisibilityChange;
  lastVisibilityChange = now;
}

function setupNavigationObserver() {
  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onNavigate();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
}

function onNavigate() {
  const newHash = hashUrl(location.href);
  if (newHash === currentUrlHash) return;

  accumulateVisible();
  currentUrlHash = newHash;
  captured = false;
  isVisible = !document.hidden;
  visibleMs = 0;
  lastVisibilityChange = Date.now();
}

const BLOCKED_PATH_FRAGMENTS = [
  '/login',
  '/signin',
  '/signup',
  '/auth/',
  '/oauth',
  '/checkout',
  '/cart',
  '/payment',
  '/settings',
  '/account',
  '/admin',
  '/dashboard',
  '/api/',
  '/graphql',
  '/compose',
  '/inbox',
  '/messages',
  '/chat',
  '/workspace',
  '/editor',
];

function hasSensitiveInputs(): boolean {
  return (
    document.querySelector('input[type="password"], input[autocomplete="current-password"]') !=
    null
  );
}

function hasEditableSurface(): boolean {
  if (document.body?.isContentEditable) return true;

  return (
    document.querySelector(
      '[contenteditable=""], [contenteditable="true"], textarea, input[type="text"], input[type="email"], input[type="search"]'
    ) != null
  );
}

function shouldSkip(): boolean {
  const { protocol, hostname, pathname } = location;
  if (!runtimeSettings.captureEnabled) return true;
  if (!protocol.startsWith('http')) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (isDomainBlocked(location.href, runtimeSettings.blockedDomains)) return true;
  if (BLOCKED_PATH_FRAGMENTS.some((fragment) => pathname.includes(fragment))) return true;
  if (hasSensitiveInputs()) return true;
  if (hasEditableSurface() && pathname.split('/').filter(Boolean).length <= 2) return true;
  if (document.contentType && !document.contentType.includes('html')) return true;
  return false;
}

function extract(): { title: string; content: string; excerpt: string; wordCount: number } | null {
  try {
    if (!document.body || document.body.innerText.trim().length < 200) return null;

    const clone = document.cloneNode(true) as Document;

    for (const selector of [
      'script',
      'style',
      'noscript',
      'svg',
      'iframe',
      'nav',
      'footer',
      'aside',
      '[aria-hidden="true"]',
    ]) {
      clone.querySelectorAll(selector).forEach((element) => element.remove());
    }

    const parsed = new Readability(clone).parse();
    if (!parsed) return null;

    const text = (parsed.textContent ?? '').replace(/\s+/g, ' ').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < runtimeSettings.minWordCount) return null;

    return {
      title: (parsed.title || document.title).trim(),
      content: text,
      excerpt: (parsed.excerpt || text.slice(0, 280)).trim(),
      wordCount,
    };
  } catch (error) {
    console.debug('[synapse] extract failed', error);
    return null;
  }
}

function getFavicon(): string | undefined {
  const candidates = [
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="128x128"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
  ];

  for (const selector of candidates) {
    const element = document.querySelector<HTMLLinkElement>(selector);
    if (element?.href) return element.href;
  }

  try {
    return new URL('/favicon.ico', location.origin).toString();
  } catch {
    return undefined;
  }
}

async function tryCapture() {
  if (captured || shouldSkip()) return;

  accumulateVisible();
  if (visibleMs < runtimeSettings.dwellThresholdMs) return;

  const extracted = extract();
  if (!extracted) return;

  captured = true;

  const message: BgMessage = {
    type: 'PAGE_CAPTURED',
    payload: {
      url: location.href,
      title: extracted.title,
      content: extracted.content,
      excerpt: extracted.excerpt,
      wordCount: extracted.wordCount,
      dwellMs: visibleMs,
      favicon: getFavicon(),
    },
  };

  try {
    await sendWithRetry(message);
  } catch (error) {
    console.debug('[synapse] capture send failed', error);
  }

  if (
    runtimeSettings.resurfaceEnabled &&
    !isDomainBlocked(location.href, runtimeSettings.blockedDomains)
  ) {
    void askResurface(extracted.content);
  }
}

async function sendWithRetry(msg: BgMessage, retries = 1): Promise<unknown> {
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch (error) {
    if (retries > 0) {
      await sleep(300);
      return sendWithRetry(msg, retries - 1);
    }
    throw error;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askResurface(content: string) {
  try {
    const response = (await sendWithRetry({
      type: 'GET_RESURFACE',
      payload: { url: location.href, content },
    } satisfies BgMessage)) as
      | { ok: boolean; data?: { title: string; url: string; similarity: number }[] }
      | undefined;

    if (response?.ok && Array.isArray(response.data) && response.data.length > 0) {
      showResurfaceToast(response.data);
    }
  } catch {
    // Ignore resurface failures. They should never block capture.
  }
}

function showResurfaceToast(items: { title: string; url: string; similarity: number }[]) {
  if (document.getElementById('synapse-resurface-toast')) return;

  const host = document.createElement('div');
  host.id = 'synapse-resurface-toast';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
        background: #13131a;
        color: #e8e8f0;
        border: 1px solid #2a2a36;
        border-radius: 14px;
        padding: 14px 16px;
        max-width: 320px;
        box-shadow: 0 24px 64px rgba(0,0,0,.5);
        animation: slide .35s cubic-bezier(.16,1,.3,1);
      }
      @keyframes slide { from { opacity: 0; transform: translateY(12px) scale(.97) } to { opacity: 1; transform: none } }
      .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg,#7c5cff,#2dd4bf); flex-shrink: 0; }
      .label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #8a8a9a; }
      .close { margin-left: auto; background: none; border: none; color: #8a8a9a; cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1; }
      .close:hover { color: #e8e8f0; }
      .item { display: flex; align-items: baseline; gap: 6px; padding: 7px 0; border-top: 1px solid #1e1e28; text-decoration: none; }
      .item-title { font-size: 13px; color: #e8e8f0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item-title:hover { color: #7c5cff; }
      .sim { font-size: 10px; color: #8a8a9a; flex-shrink: 0; }
    </style>
    <div class="wrap">
      <div class="head">
        <div class="dot"></div>
        <div class="label">Synapse - Related</div>
        <button class="close" aria-label="Dismiss">x</button>
      </div>
      ${items
        .slice(0, 3)
        .map(
          (item) => `
        <a class="item" target="_blank" rel="noreferrer" href="${escHtml(item.url)}">
          <span class="item-title">${escHtml(item.title)}</span>
          <span class="sim">${Math.round(item.similarity * 100)}%</span>
        </a>`
        )
        .join('')}
    </div>
  `;

  document.documentElement.appendChild(host);
  shadow.querySelector('.close')?.addEventListener('click', () => host.remove());
  setTimeout(() => host.remove(), 18_000);
}

function escHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  );
}

function isDomainBlocked(url: string, blockedDomains: string[]): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return false;
  }

  return blockedDomains.some((blocked) => {
    const normalized = blocked
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    return hostname === normalized || hostname.endsWith('.' + normalized);
  });
}

document.addEventListener('visibilitychange', () => {
  accumulateVisible();
  isVisible = !document.hidden;
  lastVisibilityChange = Date.now();
  if (isVisible) void tryCapture();
});

window.addEventListener('pagehide', () => {
  accumulateVisible();
  void tryCapture();
});

if (document.readyState !== 'loading') {
  setupNavigationObserver();
} else {
  document.addEventListener('DOMContentLoaded', setupNavigationObserver);
}

watchRuntimeSettings();
void loadRuntimeSettings().then(() => {
  setTimeout(() => void tryCapture(), runtimeSettings.dwellThresholdMs + 500);
});
setInterval(() => void tryCapture(), 5_000);
