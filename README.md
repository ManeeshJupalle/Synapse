# 🧠 Synapse — Your Second Brain

A privacy-first Chrome extension that passively builds a searchable knowledge graph from your browsing. No data ever leaves your browser.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![Chrome Extension](https://img.shields.io/badge/Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![Privacy](https://img.shields.io/badge/100%25_Local-10B981?logo=lock&logoColor=white)

---

## What It Does

Synapse watches what you read (not what you click — what you actually **spend time on**) and:

- **Captures** article content after a configurable dwell-time threshold (default: 15s)
- **Embeds** content locally using `all-MiniLM-L6-v2` via transformers.js (384-dim vectors, fully in-browser)
- **Connects** related pages automatically via cosine similarity
- **Clusters** your knowledge into auto-discovered topics
- **Resurfaces** forgotten content when you're reading something related
- **Searches** semantically — find pages by *meaning*, not just keywords

**Zero data leaves your browser.** No API calls. No cloud. No tracking. Everything runs on-device via ONNX/WASM.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Content   │───▶│ Background   │───▶│ IndexedDB     │  │
│  │ Script    │    │ Worker       │    │ (Dexie.js)    │  │
│  │           │    │              │    │               │  │
│  │ • Extract │    │ • Embed      │    │ • Pages       │  │
│  │ • Dwell   │    │ • Cluster    │    │ • Clusters    │  │
│  │   time    │    │ • Connect    │    │ • Connections  │  │
│  │ • Parse   │    │ • Resurface  │    │ • Resurfaces  │  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Dashboard (New Tab)                   │   │
│  │                                                    │   │
│  │  • Force-directed knowledge graph (D3)            │   │
│  │  • Semantic + keyword search                      │   │
│  │  • Timeline view                                  │   │
│  │  • Auto-discovered topic clusters                 │   │
│  │  • Settings & data export                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Embedding Engine (Web Worker)              │   │
│  │                                                    │   │
│  │  transformers.js + all-MiniLM-L6-v2 (ONNX)       │   │
│  │  384-dim embeddings · quantized · ~30ms/chunk     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension | Chrome Manifest V3, TypeScript |
| UI | React 18, TailwindCSS |
| Embeddings | transformers.js, all-MiniLM-L6-v2 (ONNX/WASM) |
| Storage | IndexedDB via Dexie.js |
| Graph Viz | react-force-graph-2d |
| Content Parsing | Mozilla Readability.js |
| Build | Vite + @crxjs/vite-plugin |

---

## Getting Started

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/synapse.git
cd synapse

# Install
npm install

# Dev (watch mode)
npm run dev

# Production build
npm run build
```

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

Open a new tab — you'll see the Synapse dashboard.

---

## Features

### 🔍 Semantic Search
Find pages by *meaning*, not just keywords. Search "machine learning optimization" and find that article about gradient descent you read 2 weeks ago — even if it never used those exact words.

### 🕸️ Knowledge Graph
Interactive force-directed graph showing how your captured pages connect. Click any node to see details, tags, and open the original page.

### 🏷️ Auto-Clustering
Synapse automatically groups related pages into topic clusters using agglomerative clustering over embedding vectors. No manual tagging needed.

### ⏰ Timeline
Chronological view of everything you've captured, grouped by day.

### 💡 Resurface Engine
While you browse, Synapse compares what you're reading against your knowledge base and surfaces forgotten related content via subtle notifications.

### 🔒 100% Local
All embeddings generated on-device via ONNX/WASM. All data stored in IndexedDB. No API keys. No telemetry. No cloud sync.

---

## Project Structure

```
synapse/
├── public/
│   ├── manifest.json          # Chrome Manifest V3
│   └── icons/                 # Extension icons
├── src/
│   ├── background/
│   │   └── index.ts           # Service worker — capture pipeline
│   ├── content/
│   │   └── index.ts           # Content script — extract & dwell time
│   ├── dashboard/
│   │   ├── index.html         # New tab page
│   │   ├── App.tsx            # Main dashboard app
│   │   └── components/
│   │       ├── KnowledgeGraph.tsx
│   │       ├── SearchPanel.tsx
│   │       ├── Timeline.tsx
│   │       ├── ClusterPanel.tsx
│   │       ├── SettingsPanel.tsx
│   │       └── StatsBar.tsx
│   └── shared/
│       ├── db/                # Dexie.js schema & queries
│       ├── embeddings/        # transformers.js wrapper
│       ├── types/             # TypeScript interfaces
│       └── utils/             # Clustering, keywords, helpers
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## Privacy

Synapse is built on a simple principle: **your browsing history is yours.**

- ✅ All processing happens locally in your browser
- ✅ Embeddings generated on-device (no API calls)
- ✅ Data stored in IndexedDB (never transmitted)
- ✅ No analytics, telemetry, or tracking
- ✅ Full data export anytime (JSON)
- ✅ One-click data deletion

---

## License

MIT
