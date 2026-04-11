import { Readability } from '@mozilla/readability';
import type { BgMessage } from '@shared/types';

const DEFAULT_DWELL_MS = 15_000;
const MIN_WORDS = 150;

let dwellStart = Date.now();
let captured = false;
let isVisible = !document.hidden;
let visibleMs = 0;
let lastVisibilityChange = Date.now();

function accumulateVisible() {
  const now = Date.now();
  if (isVisible) visibleMs += now - lastVisibilityChange;
  lastVisibilityChange = now;
}

function shouldSkip(): boolean {
  const url = location.href;
  if (!url.startsWith('http')) return true;
  if (location.hostname === 'localhost') return true;
  const badPaths = ['/login', '/signin', '/signup', '/auth', '/checkout', '/cart'];
  if (badPaths.some((p) => location.pathname.includes(p))) return true;
  return false;
}

function extract(): {
  title: string;
  content: string;
  excerpt: string;
  wordCount: number;
} | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const parsed = new Readability(clone).parse();
    if (!parsed) return null;
    const text = (parsed.textContent ?? '').replace(/\s+/g, ' ').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORDS) return null;
    return {
      title: parsed.title ?? document.title,
      content: text,
      excerpt: parsed.excerpt ?? text.slice(0, 280),
      wordCount,
    };
  } catch (e) {
    console.debug('[synapse] extract failed', e);
    return null;
  }
}

function getFavicon(): string | undefined {
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
    document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
  if (link?.href) return link.href;
  try {
    return new URL('/favicon.ico', location.origin).toString();
  } catch {
    return undefined;
  }
}

async function tryCapture() {
  if (captured || shouldSkip()) return;
  accumulateVisible();
  if (visibleMs < DEFAULT_DWELL_MS) return;

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
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    console.debug('[synapse] send failed', e);
  }

  askResurface(extracted.content);
}

async function askResurface(content: string) {
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'GET_RESURFACE',
      payload: { url: location.href, content },
    } satisfies BgMessage);
    if (res?.ok && Array.isArray(res.data) && (res.data as unknown[]).length > 0) {
      showResurfaceToast(res.data as { title: string; url: string; similarity: number }[]);
    }
  } catch {
    /* ignore */
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
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
        background: #13131a;
        color: #e8e8f0;
        border: 1px solid #2a2a36;
        border-radius: 12px;
        padding: 14px 16px;
        max-width: 320px;
        box-shadow: 0 20px 60px rgba(0,0,0,.45);
        animation: slide .35s ease-out;
      }
      @keyframes slide { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: none } }
      .head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
      .dot { width:8px; height:8px; border-radius:50%; background:#7c5cff; }
      .title { font-size:12px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; color:#8a8a9a; }
      .close { margin-left:auto; background:none; border:none; color:#8a8a9a; cursor:pointer; font-size:16px; }
      .item { display:block; font-size:13px; color:#e8e8f0; text-decoration:none; padding:6px 0; border-top:1px solid #2a2a36; }
      .item:first-of-type { border-top:none; }
      .item:hover { color:#7c5cff; }
      .sim { font-size:10px; color:#8a8a9a; margin-left:6px; }
    </style>
    <div class="wrap">
      <div class="head">
        <div class="dot"></div>
        <div class="title">Synapse · related</div>
        <button class="close">✕</button>
      </div>
      ${items
        .slice(0, 3)
        .map(
          (i) =>
            `<a class="item" target="_blank" href="${escapeHtml(i.url)}">${escapeHtml(
              i.title
            )}<span class="sim">${Math.round(i.similarity * 100)}%</span></a>`
        )
        .join('')}
    </div>
  `;
  document.documentElement.appendChild(host);
  shadow.querySelector('.close')?.addEventListener('click', () => host.remove());
  setTimeout(() => host.remove(), 15_000);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

document.addEventListener('visibilitychange', () => {
  accumulateVisible();
  isVisible = !document.hidden;
  lastVisibilityChange = Date.now();
  if (isVisible) void tryCapture();
});

window.addEventListener('beforeunload', () => {
  accumulateVisible();
  void tryCapture();
});

dwellStart = Date.now();
setTimeout(() => void tryCapture(), DEFAULT_DWELL_MS + 500);
setInterval(() => void tryCapture(), 20_000);
