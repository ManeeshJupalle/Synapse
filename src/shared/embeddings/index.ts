import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

function extensionAssetPath(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = extensionAssetPath('models/');
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = extensionAssetPath('wasm/');
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

export type ProgressCallback = (info: { status: string; progress?: number; file?: string }) => void;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
const progressListeners = new Set<ProgressCallback>();

export function onProgress(cb: ProgressCallback): () => void {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

function notifyProgress(info: Parameters<ProgressCallback>[0]) {
  for (const cb of progressListeners) cb(info);
}

export function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      local_files_only: true,
      quantized: true,
      progress_callback: (info: { status: string; progress?: number; file?: string }) => {
        notifyProgress(info);
      },
    }) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

function truncate(text: string, maxChars = 2000): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const result = await extractor(truncate(text), { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export async function warmup(): Promise<void> {
  await embed('warmup');
}
