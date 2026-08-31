import { ARKIT_BLENDSHAPE_NAMES } from '../../constants/arkit';
import { resampleTo16k } from './resample';
import { getSharedWav2ArkitEngine } from './inferenceEngine';
import type { Wav2ArkitEngineOptions } from './inferenceEngine';

const CHUNK_MS = 200; // audio window sent to the model per inference call
const FRAME_MS = 1000 / 30; // pacing clock the decoded frames are drawn out at

function nextPowerOfTwo(n: number): number {
  let p = 32;
  while (p < n && p < 32768) p *= 2;
  return p;
}

export interface Wav2ArkitLipsyncOptions extends Wav2ArkitEngineOptions {
  onFrame: (weights: Record<string, number>) => void;
}

/**
 * Runs the shared wav2arkit ONNX engine on rolling ~200ms audio windows and
 * paces the decoded ARKit blendshape frames out at ~30fps via `onFrame`.
 * Two input modes, both feeding the same inference/pacing pipeline:
 *  - `start(stream)` taps a `MediaStream` via an AnalyserNode (OpenAI, Vapi,
 *    LiveKit).
 *  - `pushAudio(samples, sampleRate)` accepts already-decoded PCM directly,
 *    for adapters that never produce a MediaStream (Deepgram).
 * One instance per active session — safe to run several concurrently (e.g.
 * multiple avatars on one page), since only the underlying model session is
 * shared.
 */
export class Wav2ArkitLipsync {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private readonly engine: ReturnType<typeof getSharedWav2ArkitEngine>;

  private chunkSamples = 0;
  private timeDomainBuffer: Float32Array = new Float32Array(0);
  private frameQueue: Record<string, number>[] = [];
  private lastFrame: Record<string, number> | null = null;
  private captureTimer: ReturnType<typeof setInterval> | null = null;
  private paceTimer: ReturnType<typeof setInterval> | null = null;
  private inferInFlight = false;
  private warmedUp = false;

  // ── Push-mode state (see `pushAudio`) ──────────────────────────────────
  private pushBuffer: number[] = [];
  private pushSampleRate = 0;
  private pushChunkSamples = 0;

  constructor(private readonly options: Wav2ArkitLipsyncOptions) {
    this.engine = getSharedWav2ArkitEngine(options);
  }

  private ensureWarmup(): void {
    if (this.warmedUp) return;
    this.warmedUp = true;
    // Fire-and-forget warmup so the model is fetched/initialized as early
    // as possible instead of stalling the first real audio chunk.
    this.engine.warmup().catch(() => {
      // First real inference call will surface (and can retry) the failure.
    });
  }

  private ensurePaceTimer(): void {
    if (this.paceTimer) return;
    this.paceTimer = setInterval(() => this.tick(), FRAME_MS);
  }

  /** Taps a `MediaStream` via an AnalyserNode. */
  public start(stream: MediaStream): void {
    if (this.audioCtx) return; // already running

    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextCtor({ latencyHint: 'interactive' });
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    this.chunkSamples = Math.round((CHUNK_MS / 1000) * this.audioCtx.sampleRate);
    const fftSize = nextPowerOfTwo(this.chunkSamples);
    this.timeDomainBuffer = new Float32Array(fftSize);

    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = fftSize;
    this.sourceNode.connect(this.analyserNode);

    this.captureTimer = setInterval(() => this.captureChunk(), CHUNK_MS);
    this.ensurePaceTimer();
    this.ensureWarmup();
  }

  private captureChunk(): void {
    if (!this.analyserNode || this.inferInFlight) return;
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer as unknown as Float32Array<ArrayBuffer>);
    const chunk = this.timeDomainBuffer.slice(this.timeDomainBuffer.length - this.chunkSamples);
    void this.runInference(chunk, this.audioCtx?.sampleRate ?? 48000);
  }

  /**
   * Feeds already-decoded PCM samples directly into the pipeline, for
   * adapters that decode raw audio themselves and never produce a
   * MediaStream. Safe to call repeatedly with irregularly-sized chunks.
   */
  public pushAudio(samples: Float32Array, sampleRate: number): void {
    if (this.pushSampleRate !== sampleRate) {
      this.pushSampleRate = sampleRate;
      this.pushChunkSamples = Math.max(1, Math.round((CHUNK_MS / 1000) * sampleRate));
      this.pushBuffer = [];
    }
    for (let i = 0; i < samples.length; i++) this.pushBuffer.push(samples[i]);

    while (this.pushBuffer.length >= this.pushChunkSamples && !this.inferInFlight) {
      const chunk = new Float32Array(this.pushBuffer.splice(0, this.pushChunkSamples));
      void this.runInference(chunk, sampleRate);
    }

    this.ensurePaceTimer();
    this.ensureWarmup();
  }

  private async runInference(chunk: Float32Array, sampleRate: number): Promise<void> {
    this.inferInFlight = true;
    try {
      const resampled = await resampleTo16k(chunk, sampleRate);
      const frames = await this.engine.run(resampled);
      for (const frame of frames) {
        const weights: Record<string, number> = {};
        for (let i = 0; i < ARKIT_BLENDSHAPE_NAMES.length; i++) {
          weights[ARKIT_BLENDSHAPE_NAMES[i]] = frame[i] ?? 0;
        }
        this.frameQueue.push(weights);
      }
    } catch {
      // Drop this window on inference failure; the pacing clock holds the
      // last good frame and the next chunk will retry.
    } finally {
      this.inferInFlight = false;
    }
  }

  private tick(): void {
    const next = this.frameQueue.shift();
    if (next) {
      this.lastFrame = next;
      this.options.onFrame(next);
    } else if (this.lastFrame) {
      this.options.onFrame(this.lastFrame);
    }
  }

  public stop(): void {
    if (this.captureTimer) clearInterval(this.captureTimer);
    if (this.paceTimer) clearInterval(this.paceTimer);
    this.captureTimer = null;
    this.paceTimer = null;

    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.frameQueue = [];
    this.lastFrame = null;
    this.pushBuffer = [];
    this.pushSampleRate = 0;
  }
}
