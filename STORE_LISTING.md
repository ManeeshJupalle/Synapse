# Chrome Web Store Listing

---

## Short Description (132 chars max)

Build a private knowledge graph from your browsing — semantic search, auto-clusters & resurface. 100% local, no servers.

> Character count: 120 — within the 132-character limit.

---

## Full Description

You read dozens of articles, docs, and posts every week. Then they vanish — buried in history, forgotten by morning. You know you read something useful about that topic, but you can't remember where, and keyword search fails you because you remember the idea, not the words. That's the problem Synapse solves.

**What Synapse does**

Synapse works silently in the background while you browse. When you stay on a page for at least 15 seconds — the threshold that separates genuine reading from a stray click — it captures the content, strips away ads and clutter using Mozilla Readability, and generates a semantic embedding entirely inside your browser using the all-MiniLM-L6-v2 model via ONNX and WebAssembly. That 384-dimension vector fingerprint is stored locally in IndexedDB alongside the page metadata. No network call is ever made. As your library grows, Synapse computes cosine similarity between every new page and every existing one, automatically drawing edges between related content and grouping pages into topic clusters through agglomerative clustering — all without you lifting a finger. The result is a living knowledge graph that gets richer every time you read.

---

**🔍 Semantic Search**

Search by meaning, not keywords. Type what you remember — a concept, a half-recalled idea, a question — and Synapse finds relevant pages even when the exact words never appeared on them. Search "machine learning optimization" and surface that gradient descent deep-dive you read three weeks ago. Search "dealing with burnout" and rediscover that productivity essay you bookmarked and forgot. Because the search runs against embedding vectors rather than full-text indexes, it understands synonyms, related concepts, and context automatically.

**🕸️ Knowledge Graph**

Open a new tab and you'll see your knowledge visualized as an interactive force-directed graph powered by D3. Every node is a page you've read. Every edge is a semantic connection Synapse discovered automatically. Clusters of related content pull together; unrelated pages drift apart. Click any node to see its title, your captured excerpt, auto-generated topic tags, and a button to return to the original page. The graph is a map of your mind — it shows you not just what you've read, but how the ideas relate.

**🏷️ Auto-Clustering**

Synapse groups your captured pages into topic clusters without any manual tagging. The clustering algorithm runs over your embedding vectors and discovers natural groupings — all your machine learning pages in one cluster, all your personal finance reading in another, all your notes on a specific project in a third. Clusters are labeled automatically. You can browse by cluster to see everything you've absorbed on a theme, even when the sources span months and dozens of different websites.

**⏰ Timeline**

A clean chronological view of every page you've captured, grouped by day. Useful for retracing your research sessions, reviewing what you read this week, or finding something you captured on a specific date. Pairs well with the graph view — the timeline gives you the sequence; the graph gives you the structure.

**💡 Resurface Engine**

This is Synapse's most distinctive feature. As you read a page, the extension quietly compares it against your existing knowledge base in real time. If it detects meaningful semantic overlap with something you captured before, it surfaces a subtle toast notification — a gentle nudge that says "you've read something related." Click it to revisit the forgotten page. No intrusive popups, no constant notifications. It only fires when the similarity is genuinely high, so it earns your attention rather than wasting it.

**🔒 100% Local — Your Data Never Leaves Your Browser**

This is not a marketing claim with fine-print exceptions. The all-MiniLM-L6-v2 embedding model runs entirely inside your browser tab via ONNX Runtime Web and WebAssembly. There is no backend server. There is no API key to configure. There is no account to create. Your browsing history, your captured content, your embedding vectors — all of it lives exclusively in your browser's IndexedDB storage. You can export everything to JSON at any time from the Settings panel, and you can delete all stored data in one click. Synapse has no telemetry, no analytics, and no way to phone home even if it wanted to.

---

**Privacy, by design**

Most "second brain" tools require you to send your data to a cloud service to generate AI features. Synapse takes the opposite approach: the intelligence runs on your device. The tradeoff is a first-run model load (~25MB, downloaded once and cached), not ongoing privacy exposure. We believe that's a worthwhile exchange. Your browsing history is yours.

Synapse is open source under the MIT license. The full source code is available on GitHub. Security researchers, privacy advocates, and curious developers are welcome to audit exactly what the extension does with your data.

---

**Getting started**

1. Install Synapse from the Chrome Web Store.
2. Open a new tab — the Synapse dashboard will appear.
3. Browse normally. Read articles, docs, research, anything you care about. Stay on pages for more than 15 seconds.
4. Come back in 10 minutes. Your first pages will already be captured, embedded, and connected.

The graph starts sparse and gets richer with every reading session. After a week of normal browsing, patterns will emerge that you didn't consciously notice.

---

**Feedback and contributions**

Synapse is v0.1.0 — an early release built to validate the core experience. If something breaks, if a feature feels wrong, or if you have an idea, please open an issue on GitHub. This project grows through community feedback.

---

## Category

Productivity

---

## Language

English

---

## Permissions Justification

*(For the Chrome Web Store submission form — provide these explanations in the "Permissions" field.)*

- **storage**: Required to persist captured pages, embedding vectors, topic clusters, and user settings in IndexedDB via Dexie.js. All data is stored locally on the user's device and never transmitted.

- **tabs**: Required to read the URL and title of the currently active tab so captured pages can be associated with their source and opened from the dashboard graph view.

- **activeTab**: Required to run the content extraction script on the page the user is currently reading, in order to capture article text and measure dwell time after the 15-second threshold is met.

- **host_permissions `<all_urls>`**: Required because Synapse captures content from any website the user chooses to read — there is no fixed list of supported domains. The content script only activates after the dwell threshold is met, and only on pages the user navigates to themselves.

---

## Screenshots Guide

*(5 screenshots at 1280×800px. Capture in Chrome with the browser UI hidden or cropped out. Use a dark theme for visual consistency.)*

---

**Screenshot 1 — The Empty Start**

- **What to show**: The Synapse new-tab dashboard immediately after installation, before any pages have been captured. Show the empty graph canvas with a soft placeholder message ("Start browsing — your knowledge graph will grow here") and the stats bar showing 0 pages, 0 connections, 0 clusters.
- **Extension state**: Freshly installed, zero captured pages.
- **Suggested caption**: "Your knowledge graph starts empty and grows with every page you read."

---

**Screenshot 2 — Capturing in Progress**

- **What to show**: A real article or blog post open in Chrome, with the Synapse resurface toast visible in the bottom-right corner showing "Synapse captured this page." Optionally show the extension icon in the toolbar with a badge.
- **Extension state**: 5–10 pages captured. The user has just crossed the 15-second dwell threshold on a new article.
- **Suggested caption**: "After 15 seconds of reading, Synapse silently captures and embeds the page — no clicks needed."

---

**Screenshot 3 — The Knowledge Graph**

- **What to show**: The new-tab graph view with 40–80 nodes visible, several visible clusters pulled together by the force layout, edges visible between related nodes, one node selected and showing its detail panel on the right (title, excerpt, tags, "Open page" button).
- **Extension state**: ~60 captured pages across 3–4 distinct topic areas (e.g. software development, health/fitness, finance). Enough edges to make the graph look rich without being incomprehensible.
- **Suggested caption**: "Every node is a page you've read. Every edge is a connection Synapse found automatically."

---

**Screenshot 4 — Semantic Search Results**

- **What to show**: The search panel open with a natural-language query typed in — something like "managing technical debt in large codebases" — and 4–6 results shown below it with page titles, source domains, and relevance indicators. At least one result should have a title that doesn't contain any of the search keywords, demonstrating semantic (not keyword) matching.
- **Extension state**: ~60 captured pages, search query entered and results displayed.
- **Suggested caption**: "Search by meaning, not keywords — find what you remember, even if you've forgotten how it was worded."

---

**Screenshot 5 — Clusters View**

- **What to show**: The cluster panel view with 4–5 auto-discovered topic clusters displayed as cards or list items, each with a cluster label (e.g. "Machine Learning", "Personal Finance", "React Development"), a page count, and 2–3 thumbnail titles beneath each cluster name.
- **Extension state**: ~60 captured pages fully clustered.
- **Suggested caption**: "Synapse groups everything you've read into topics automatically — no folders, no tagging, no manual work."

---

## Promotional Tile (440×280)

**Layout**: Dark background (#0f1117 or similar near-black). Centered layout, no image bleed.

**Visual**: A minimal, stylized version of the knowledge graph — 7–9 white dots (nodes) connected by thin white lines, arranged organically in the center of the tile. Dots should vary slightly in size to suggest importance. Lines should be low opacity (~40%) so they read as subtle connections, not clutter.

**Text**:
- Top-left or top-center: Small "🧠 Synapse" logotype in white, ~14px equivalent
- Center-bottom, below the graph illustration: One headline in white, bold, ~24px: **"Your browsing, remembered."**
- Below the headline: Very small subline in muted gray: "100% local · no cloud · no account"

**Do not include**: screenshots, browser chrome, long paragraphs, or more than two lines of text. The tile should read clearly at small sizes.

---

## Keywords / Tags

1. `second brain`
2. `knowledge graph`
3. `semantic search`
4. `privacy`
5. `productivity`

---

## Version Notes for v0.1.0

**What's new in v0.1.0 — Initial Release**

Synapse launches with its full core feature set: passive page capture with a 15-second dwell threshold, on-device semantic embeddings via all-MiniLM-L6-v2 (ONNX/WASM), an interactive force-directed knowledge graph, semantic and keyword search, auto-discovered topic clustering, a chronological timeline view, and the Resurface engine that surfaces forgotten related content as you browse. All processing is 100% local — no servers, no API keys, no accounts. Data export and one-click deletion are available in Settings. This release is focused on validating the core capture-and-connect loop; performance tuning, richer graph interactions, and additional views are planned for subsequent releases based on user feedback.
