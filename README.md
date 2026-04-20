# Synapse

Synapse is a privacy-first Chrome extension that turns normal browsing into a personal knowledge graph.

It captures pages you actually spend time reading, embeds them locally, connects related ideas, and gives you a searchable "second brain" without sending your browsing history to a server.

---

## Why This Exists

Browser history is a poor memory system.

Most of the time you do not remember the exact title of something you read. You remember the idea, the topic, or a fragment of the concept. Traditional history and bookmark search break down there.

Synapse was built to test a simple product thesis:

> Can a browser become a private memory layer that passively captures, organizes, and retrieves what you read?

That is why this project exists. It is not just a graph visualizer. It is an attempt to build an on-device memory system for browsing.

---

## What It Does

Synapse watches for pages you genuinely read and then:

- captures the main article content after a configurable dwell threshold
- embeds the content locally using a bundled `all-MiniLM-L6-v2` model
- stores everything in IndexedDB on the device
- creates similarity-based connections between related pages
- groups related pages into topic clusters
- lets you search by meaning, not only by keywords
- resurfaces older related pages while you browse

The goal is to make previously read information retrievable by concept, not just by exact wording.

---

## Recent Changes

The README now reflects the current implementation, including the major launch-readiness fixes already made:

- the embedding model and ONNX WASM binaries are bundled locally with the extension
- the extension no longer depends on remote fonts at runtime
- dwell threshold, minimum word count, blocked domains, and capture/resurface toggles are now honored by the content script
- turning capture off now stops capture and resurface work instead of only blocking storage later
- delete-all now clears queued capture jobs before wiping IndexedDB
- model readiness reports loading and failure states accurately instead of assuming warmup succeeded
- manifest scope is limited to `storage` plus normal `http` and `https` pages
- baseline Vitest coverage now runs in CI before the production build
- the build pipeline now syncs the local ML assets automatically

Related files:

- [`src/shared/embeddings/index.ts`](src/shared/embeddings/index.ts)
- [`src/content/index.ts`](src/content/index.ts)
- [`scripts/sync-local-ml-assets.mjs`](scripts/sync-local-ml-assets.mjs)
- [`public/manifest.json`](public/manifest.json)

---

## Privacy Model

Synapse is designed around one rule: your browsing memory should stay on your machine.

- All embedding inference runs inside the extension.
- The model files and ONNX runtime binaries ship with the extension package.
- The extension does not fetch models, fonts, or inference assets at runtime.
- Captured data is stored in IndexedDB via Dexie.
- There is no account system.
- There is no telemetry, analytics, or cloud sync.
- Users can export their data as JSON or delete it from settings.

This does not stop websites themselves from making their own network requests. It means Synapse does not initiate external runtime requests for its own AI pipeline or UI assets.

---

## Product Flow

```text
Page you read
  -> content script measures visible dwell time
  -> Readability extracts the main article text
  -> background worker embeds and stores the page
  -> similarity edges and clusters are updated
  -> dashboard exposes graph, search, timeline, and settings
```

More concretely:

1. The content script waits until the page has been visible long enough and passes the capture filters.
2. The page is parsed into clean article text with Mozilla Readability.
3. The background worker generates a local embedding, stores the page, and updates graph metadata.
4. The dashboard renders the resulting knowledge graph and search UI from IndexedDB.

---

## Core Features

### Semantic Search

Search by meaning instead of exact text match. If you remember the concept but not the wording, Synapse can still surface the page.

### Knowledge Graph

Pages become nodes. Similar pages become edges. The graph helps reveal topic neighborhoods rather than just a flat history list.

### Auto-Clustering

Pages are grouped into topic clusters using agglomerative clustering over the stored embeddings.

### Timeline

Everything captured is also available chronologically, grouped by day.

### Resurface

While you browse, Synapse can surface previously captured pages that are semantically related to the current page.

### Settings and Data Controls

Users can adjust capture thresholds, manage blocked domains, export JSON backups, reindex pages, and delete stored data.

---

## Runtime Behavior

Synapse currently behaves as follows:

- capture starts only when `captureEnabled` is on
- pages must satisfy the configured dwell threshold and minimum word count
- blocked domains are skipped in the content script and again in the background worker
- common inbox, chat, workspace, editor, and login-like pages are skipped by default
- the embedding model is loaded from packaged extension assets
- search supports both semantic mode and keyword mode
- the dashboard is exposed as the new tab page

---

## Architecture

```text
Synapse
|- content script
|  |- dwell tracking
|  |- page filtering
|  |- article extraction
|  `- resurface trigger
|- background service worker
|  |- job queue
|  |- embedding pipeline
|  |- search
|  |- connection rebuild
|  `- reclustering
|- IndexedDB
|  |- pages
|  |- clusters
|  |- connections
|  |- resurfaces
|  `- settings
`- dashboard
   |- graph view
   |- timeline
   |- clusters
   |- search
   `- settings
```

### Main Modules

- `src/content`
  The content script. Measures dwell time, extracts readable content, and asks the background worker to capture or resurface.

- `src/background`
  The service worker. Owns embedding, storage, search, connections, clustering, import/export, and status.

- `src/dashboard`
  The React-based new-tab UI. Visualizes the stored knowledge base and exposes search and settings.

- `src/shared`
  Shared types, database helpers, embedding wrapper, and utility logic.

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Extension runtime | Chrome Manifest V3, TypeScript |
| UI | React 18, Tailwind CSS |
| Storage | IndexedDB via Dexie |
| Parsing | Mozilla Readability |
| Embeddings | `@xenova/transformers`, `all-MiniLM-L6-v2`, ONNX WASM |
| Graph visualization | `react-force-graph-2d` |
| Build | Vite, `@crxjs/vite-plugin` |

---

## Project Structure

```text
synapse/
|- docs/
|  `- index.html                  Privacy policy page
|- public/
|  |- icons/                      Extension icons
|  |- manifest.json               MV3 manifest
|  |- models/                     Bundled embedding model assets
|  `- wasm/                       Bundled ONNX WASM runtime files
|- scripts/
|  |- generate-icons.mjs
|  `- sync-local-ml-assets.mjs
|- src/
|  |- background/
|  |  `- index.ts
|  |- content/
|  |  `- index.ts
|  |- dashboard/
|  |  |- App.tsx
|  |  |- index.html
|  |  |- main.tsx
|  |  |- styles.css
|  |  |- components/
|  |  `- hooks/
|  `- shared/
|     |- db/
|     |- embeddings/
|     |- types/
|     `- utils/
|- STORE_LISTING.md
|- package.json
`- vite.config.ts
```

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite development mode |
| `npm run build` | Sync local ML assets, generate icons, typecheck, and build the extension |
| `npm run test` | Run the Vitest suite |
| `npm run typecheck` | Run TypeScript checking only |
| `npm run icons` | Regenerate extension icons |
| `npm run ml-assets` | Sync the bundled model and ONNX WASM assets |

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Make sure local ML assets exist

This is already handled during `npm run build`, but you can run it directly if needed:

```bash
npm run ml-assets
```

### 3. Start development

```bash
npm run dev
```

### 4. Build the extension

```bash
npm run build
```

### 5. Load into Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `dist/` folder

The dashboard will appear on a new tab because the extension overrides Chrome's new tab page.

---

## Configuration and Settings

The dashboard settings panel currently controls:

- capture enabled
- dwell threshold
- minimum word count
- connection threshold
- cluster threshold
- resurface similarity threshold
- resurface cooldown
- blocked domains
- export, import, reindex, and delete actions

Settings are stored locally and mirrored into `chrome.storage.local` so the content script can react to them in real time.

---

## Storage Model

Synapse stores the following collections in IndexedDB:

- `pages`
  Captured pages with metadata, excerpt, truncated content, embedding, keywords, and cluster assignment.

- `clusters`
  Topic groupings derived from page embeddings.

- `connections`
  Similarity edges between related pages.

- `resurfaces`
  Records of resurfaced pages and when they were shown.

- `settings`
  Local configuration used by the dashboard, content script, and background worker.

---

## Permissions

The manifest currently requests:

- `storage`
- host permissions for `http://*/*` and `https://*/*`

Why:

- `storage` persists pages, settings, clusters, and queue state locally
- host permissions allow the content script to run on ordinary web pages the user opens

Current guardrails:

- no `tabs` permission
- no `activeTab` permission
- no capture on browser-internal or non-HTTP(S) pages
- common mail, chat, workspace, editor, and login domains are blocked by default

---

## Current Status

The core loop is working:

- capture
- local embedding
- storage
- graph connection
- clustering
- semantic search
- dashboard exploration

High-priority launch blockers around remote runtime dependencies and settings mismatches have been addressed.

Medium-priority hardening is now also in place:

- delete-all clears pending queue state before data is removed
- model status exposes loading and error states correctly
- capture scope is limited to standard web pages and the unused tab permissions are gone
- baseline automated tests run in CI before build artifacts are produced

The next hardening pass should focus on:

- broader integration tests around capture, import/export, and background workflows
- cluster scaling beyond the current recency cap
- browser-level QA for real-world site behavior before launch

---

## Related Docs

- [`docs/index.html`](docs/index.html) - privacy policy page
- [`STORE_LISTING.md`](STORE_LISTING.md) - Chrome Web Store listing draft

---

## License

MIT
