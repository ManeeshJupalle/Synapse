import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

export function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
    }) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

function truncate(text: string, maxChars = 2000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
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
  try {
    await embed('warmup');
  } catch (e) {
    console.warn('[synapse] warmup failed', e);
  }
}
