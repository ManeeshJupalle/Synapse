# Chrome Web Store Listing

---

## Short Description

Private browsing memory with semantic search, topic clusters, and resurfacing. Runs 100% locally in your browser.

---

## Full Description

You read useful pages all week, then lose them in browser history.

You usually remember the idea, not the exact title or keyword. That is the problem Synapse is built to solve.

Synapse turns normal browsing into a private memory layer. It watches for pages you actually spend time reading, extracts the main article text, generates a semantic embedding locally on your device, and stores that page in a personal knowledge graph you can search later.

Everything happens locally inside the extension. There is no account, no API key, no cloud sync, and no telemetry.

### What Synapse does

- Captures pages after meaningful reading time. The default dwell threshold is 15 seconds and can be changed in Settings.
- Extracts clean article text with Mozilla Readability.
- Generates embeddings locally with the bundled `all-MiniLM-L6-v2` model running through ONNX WebAssembly.
- Stores captured pages, embeddings, topic clusters, and settings in local IndexedDB storage.
- Builds connections between related pages based on semantic similarity.
- Lets you search by meaning, not only by exact keywords.
- Surfaces older related pages while you browse.

### Core features

**Semantic search**

Search for an idea, not a literal phrase. If you remember the concept but not the title, Synapse can still find the page.

**Knowledge graph**

Each captured page becomes a node. Related pages become edges. Over time, the graph shows how the topics you read connect to each other.

**Auto-clustering**

Synapse groups related pages into topic clusters automatically, without folders or manual tagging.

**Timeline**

Browse everything you captured in chronological order.

**Resurface**

While you read, Synapse can quietly suggest previously captured pages that are strongly related to the current one.

**Data controls**

You can export your local data to JSON, reindex embeddings, manage blocked domains, and delete everything in one click.

### Privacy model

Synapse is designed to keep your browsing memory on your machine.

- The embedding model and ONNX runtime binaries ship with the extension package.
- The extension does not fetch models, fonts, or inference assets at runtime.
- Synapse stores data locally and does not send captured page content to a server.
- There is no telemetry or analytics pipeline.

This does not stop the websites you visit from making their own network requests. It means Synapse itself does not make external runtime requests for its AI pipeline or UI.

### Scope and safeguards

Synapse only runs on normal `http` and `https` pages.

- It does not request `tabs` permission.
- It does not request `activeTab` permission.
- It does not run on browser-internal pages.
- Common mail, chat, workspace, editor, and login domains are blocked by default.
- Users can add more blocked domains in Settings at any time.

### Getting started

1. Install Synapse from the Chrome Web Store.
2. Open a new tab to access the Synapse dashboard.
3. Browse normally and spend time on pages you actually want to keep.
4. Return to the dashboard to explore your graph, search your history by meaning, and review topic clusters.

Synapse is an early release focused on validating the core capture-and-recall loop. The product already covers passive capture, local embeddings, graph connections, clustering, search, timeline browsing, and resurfacing.

---

## Category

Productivity

---

## Language

English

---

## Permissions Justification

- **storage**: Required to persist captured pages, topic clusters, settings, resurfacing history, and pending local processing state. All data stays on the device.
- **host permissions `http://*/*` and `https://*/*`**: Required so the content script can observe dwell time and extract readable article content from ordinary web pages the user opens. Synapse does not run on browser-internal pages, and sensitive communication and workspace domains are blocked by default.

---

## Screenshots Guide

### Screenshot 1 - Empty dashboard

- **What to show**: The new-tab dashboard immediately after install with zero pages captured.
- **Caption**: "Your browsing memory starts empty and grows as you read."

### Screenshot 2 - Passive capture

- **What to show**: A real article open in Chrome after the default dwell threshold has passed.
- **Caption**: "Synapse captures pages you actually read, without extra clicks."

### Screenshot 3 - Knowledge graph

- **What to show**: The graph view populated with several clusters and one selected page detail panel.
- **Caption**: "Every node is a page you read. Every edge is a relationship Synapse found automatically."

### Screenshot 4 - Semantic search

- **What to show**: A natural-language query with several relevant results.
- **Caption**: "Search by meaning, not only by exact keywords."

### Screenshot 5 - Cluster view

- **What to show**: The clusters panel with multiple auto-labeled topic groups.
- **Caption**: "Synapse organizes your reading into topics automatically."

---

## Promotional Tile

- **Background**: Deep charcoal or near-black.
- **Visual**: A simple connected-node graph in the center.
- **Headline**: `Your browsing, remembered.`
- **Subline**: `100% local. No cloud. No account.`

Keep the tile minimal and readable at small sizes.

---

## Keywords

1. `second brain`
2. `knowledge graph`
3. `semantic search`
4. `privacy`
5. `productivity`

---

## Version Notes

### v0.1.0

Initial release of Synapse with:

- passive page capture after a configurable dwell threshold
- fully local embeddings using bundled `all-MiniLM-L6-v2` and ONNX WASM
- interactive knowledge graph and timeline views
- semantic and keyword search
- automatic topic clustering
- resurfacing of related pages while browsing
- local export, import, reindex, and delete controls
