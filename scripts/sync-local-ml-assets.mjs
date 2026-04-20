import { copyFileSync, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const modelDir = resolve(rootDir, 'public/models/Xenova/all-MiniLM-L6-v2');
const wasmDir = resolve(rootDir, 'public/wasm');
const wasmSourceDir = resolve(rootDir, 'node_modules/@xenova/transformers/dist');
const modelRevision = '751bff37182d3f1213fa05d7196b954e230abad9';
const modelBaseUrl = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${modelRevision}`;

const modelFiles = [
  'config.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.txt',
  'onnx/model_quantized.onnx',
];

const wasmFiles = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd.wasm',
  'ort-wasm-threaded.wasm',
  'ort-wasm.wasm',
];

async function ensureModelFile(relativePath) {
  const destination = resolve(modelDir, relativePath);
  if (existsSync(destination)) {
    console.log(`  ok ${relativePath}`);
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  const response = await fetch(`${modelBaseUrl}/${relativePath}`);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${relativePath}: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  console.log(`  downloaded ${relativePath}`);
}

function ensureWasmFile(fileName) {
  const source = resolve(wasmSourceDir, fileName);
  const destination = resolve(wasmDir, fileName);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  console.log(`  copied ${fileName}`);
}

console.log('Syncing local ML assets...');
mkdirSync(modelDir, { recursive: true });
mkdirSync(wasmDir, { recursive: true });

for (const file of modelFiles) {
  await ensureModelFile(file);
}

for (const file of wasmFiles) {
  ensureWasmFile(file);
}

console.log('Local ML assets are ready.');
