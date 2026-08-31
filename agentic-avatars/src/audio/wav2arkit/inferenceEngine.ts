import * as ort from 'onnxruntime-web';
import { loadWav2ArkitModel } from './modelLoader';
import type { LoadWav2ArkitModelOptions } from './modelLoader';

// Must match the installed onnxruntime-web version so the WASM binaries
// fetched from the CDN match the JS glue bundled into this package.
const ONNXRUNTIME_WEB_VERSION = '1.29.0';

let wasmConfigured = false;
function ensureWasmConfigured(): void {
  if (wasmConfigured) return;
  // Load WASM binaries from a CDN rather than requiring downstream bundlers
  // to copy onnxruntime-web's static assets — keeps this a zero-config peer.
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNXRUNTIME_WEB_VERSION}/dist/`;
  ort.env.wasm.numThreads = 1; // avoids requiring cross-origin-isolation headers for multi-threaded WASM
  wasmConfigured = true;
}

export interface Wav2ArkitEngineOptions extends LoadWav2ArkitModelOptions {
  /** Output frame rate the model was trained/exported at. Defaults to 30. */
  fps?: number;
}

/** Client-side wav2arkit inference: raw mono audio (16kHz) -> ARKit blendshape frames. */
export class Wav2ArkitEngine {
  private sessionPromise: Promise<ort.InferenceSession> | null = null;
  private inputName = '';
  private outputName = '';
  private fps: number;
  private options: Wav2ArkitEngineOptions;

  constructor(options: Wav2ArkitEngineOptions = {}) {
    this.options = options;
    this.fps = options.fps ?? 30;
  }

  private getSession(): Promise<ort.InferenceSession> {
    if (!this.sessionPromise) {
      ensureWasmConfigured();
      this.sessionPromise = (async () => {
        const { model, externalData } = await loadWav2ArkitModel(this.options);
        const session = await ort.InferenceSession.create(model, {
          executionProviders: ['wasm'],
          externalData: [{ path: 'wav2arkit_cpu.onnx.data', data: externalData }],
        });
        this.inputName = session.inputNames[0];
        this.outputName = session.outputNames[0];
        return session;
      })().catch((err) => {
        // Allow a later call to retry instead of permanently caching a rejection.
        this.sessionPromise = null;
        throw err;
      });
    }
    return this.sessionPromise;
  }

  /** Fetches the model and runs a throwaway inference to pay startup cost ahead of real audio. */
  public async warmup(): Promise<void> {
    const session = await this.getSession();
    await this.runRaw(session, new Float32Array(16000));
  }

  /** Runs inference on a chunk of mono float32 audio already resampled to 16kHz. */
  public async run(audio16k: Float32Array): Promise<Float32Array[]> {
    const session = await this.getSession();
    return this.runRaw(session, audio16k);
  }

  private async runRaw(session: ort.InferenceSession, audio16k: Float32Array): Promise<Float32Array[]> {
    const tensor = new ort.Tensor('float32', audio16k, [1, audio16k.length]);
    const outputs = await session.run({ [this.inputName]: tensor });
    const output = outputs[this.outputName];
    const dims = output.dims;
    const seqLen = dims[dims.length - 2];
    const numBlendshapes = dims[dims.length - 1];
    const data = output.data as Float32Array;

    const expectedFrames = Math.round((audio16k.length / 16000) * this.fps);
    const frameCount = Math.min(seqLen, expectedFrames || seqLen);

    const frames: Float32Array[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push(data.subarray(i * numBlendshapes, (i + 1) * numBlendshapes));
    }
    return frames;
  }
}

let sharedEngine: Wav2ArkitEngine | null = null;

/** Returns a shared engine instance so the (large) model is only fetched/initialized once per page. */
export function getSharedWav2ArkitEngine(options: Wav2ArkitEngineOptions = {}): Wav2ArkitEngine {
  if (!sharedEngine) sharedEngine = new Wav2ArkitEngine(options);
  return sharedEngine;
}
