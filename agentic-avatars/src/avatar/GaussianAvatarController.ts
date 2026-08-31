import * as GaussianSplats3D from '@myned-ai/gsplat-flame-avatar-renderer';
import { createNeutralWeights } from '../constants/arkit';
import type { ChatState } from '../types';

// Blink patterns matching wav2arkit's own reference blink shapes (7 frames each)
const BLINK_PATTERNS = [
  [0.1, 0.3, 0.7, 1.0, 0.7, 0.3, 0.1],
  [0.15, 0.4, 0.8, 1.0, 0.6, 0.25, 0.1],
  [0.1, 0.35, 0.75, 1.0, 0.75, 0.35, 0.1],
  [0.2, 0.5, 0.9, 1.0, 0.7, 0.3, 0.05],
];

// Blink intervals per state (min, max) in milliseconds
const BLINK_INTERVALS: Record<ChatState, [number, number]> = {
  Idle: [2000, 4000], // Relaxed: 2-4 seconds
  Responding: [1300, 3300], // Speaking: natural rate
};

export interface Disposable {
  dispose(): void;
}

/**
 * Interface any avatar controller must implement to integrate with
 * `AvatarAgent` / `AvatarContainer`.
 */
export interface IAvatarController {
  updateBlendshapes(weights: Record<string, number>): void;
  setChatState(state: ChatState): void;
  getChatState(): ChatState;
  enableLiveBlendshapes(): void;
  disableLiveBlendshapes(): void;
  dispose(): void;
  pause?(): void;
  resume?(): void;
}

/**
 * GaussianAvatarController wraps `@myned-ai/gsplat-flame-avatar-renderer`.
 *
 * TWO animation systems work together:
 * 1. BODY ANIMATIONS — driven by ChatState ('Idle' | 'Responding'), handled
 *    internally by the renderer.
 * 2. FACIAL BLENDSHAPES — 52 ARKit blendshapes streamed in real time from
 *    the wav2arkit lipsync engine via `updateBlendshapes`.
 *
 * Blinking is owned entirely by the client (this class) and always
 * overrides any blink values present in incoming blendshape frames.
 */
export class GaussianAvatarController implements IAvatarController, Disposable {
  private _container: HTMLDivElement;
  private _assetsPath: string;
  private _backgroundColor?: string;
  private _onLoadProgress?: (progress: number) => void;
  public curState: ChatState = 'Idle';
  private _renderer: GaussianSplats3D.GaussianSplatRenderer | null = null;
  private forceEyesClosed = false;
  private liveBlendshapeData: Record<string, number> | null = null;
  private isPaused = false;
  private neutralBlendshapes: Record<string, number>;

  // Blink state (applies in every ChatState, not just idle)
  private lastBlinkTime = 0;
  private nextBlinkInterval = 2000;
  private blinkFrame = -1; // -1 = not blinking, 0-6 = blink frame
  private currentBlinkPattern: number[] = BLINK_PATTERNS[0];
  private blinkIntensity = 1.0;
  private lastBlinkFrameTime = 0;

  constructor(
    container: HTMLDivElement,
    assetsPath: string,
    options: { backgroundColor?: string; onLoadProgress?: (progress: number) => void } = {},
  ) {
    if (!container || !assetsPath) {
      throw new Error('GaussianAvatarController requires a container element and an assetsPath');
    }
    this._container = container;
    this._assetsPath = assetsPath;
    this._backgroundColor = options.backgroundColor;
    this._onLoadProgress = options.onLoadProgress;
    this.neutralBlendshapes = createNeutralWeights();
  }

  public async start(): Promise<void> {
    this._renderer = await GaussianSplats3D.GaussianSplatRenderer.getInstance(this._container, this._assetsPath, {
      getChatState: this.getChatState.bind(this),
      getExpressionData: this.getArkitFaceFrame.bind(this),
      backgroundColor: this._backgroundColor,
      loadProgress: this._onLoadProgress,
    });
  }

  /** Forces the avatar's eyes closed, overriding blink logic. */
  public closeEyes(): void {
    this.forceEyesClosed = true;
  }

  /** Pause animation — returns the neutral pose. */
  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getChatState(): ChatState {
    return this.curState;
  }

  public setChatState(state: ChatState): void {
    this.curState = state;
  }

  /** Kept for IAvatarController compatibility — blendshapes always stream once available. */
  public enableLiveBlendshapes(): void {
    // no-op: this controller always applies the latest pushed blendshapes.
  }

  public disableLiveBlendshapes(): void {
    this.liveBlendshapeData = null;
  }

  /** Push the latest blendshape frame from the wav2arkit lipsync engine. */
  public updateBlendshapes(weights: Record<string, number>): void {
    this.liveBlendshapeData = weights;
  }

  /**
   * Pulled by the renderer once per render frame.
   * Client-owned blinking always overrides any blink values in `weights`.
   */
  public getArkitFaceFrame(): Record<string, number> {
    if (this.isPaused) {
      return this.neutralBlendshapes;
    }

    const result: Record<string, number> = this.liveBlendshapeData
      ? { ...this.liveBlendshapeData }
      : { ...this.neutralBlendshapes };

    if (this.forceEyesClosed) {
      result['eyeBlinkLeft'] = 1.0;
      result['eyeBlinkRight'] = 1.0;
      return result;
    }

    this.applyBlink(result);
    return result;
  }

  private applyBlink(blendshapes: Record<string, number>): void {
    const now = performance.now();
    const [minInterval, maxInterval] = BLINK_INTERVALS[this.curState] ?? BLINK_INTERVALS.Idle;

    if (this.blinkFrame === -1) {
      if (now - this.lastBlinkTime >= this.nextBlinkInterval) {
        this.blinkFrame = 0;
        this.lastBlinkFrameTime = now;
        this.currentBlinkPattern = BLINK_PATTERNS[Math.floor(Math.random() * BLINK_PATTERNS.length)];
        this.blinkIntensity = 0.8 + Math.random() * 0.2;
        this.nextBlinkInterval = minInterval + Math.random() * (maxInterval - minInterval);
      }
    }

    if (this.blinkFrame >= 0 && this.blinkFrame < 7) {
      const blinkValue = this.currentBlinkPattern[this.blinkFrame] * this.blinkIntensity;
      blendshapes['eyeBlinkLeft'] = blinkValue;
      blendshapes['eyeBlinkRight'] = blinkValue;

      if (now - this.lastBlinkFrameTime >= 33) {
        this.blinkFrame++;
        this.lastBlinkFrameTime = now;

        if (this.blinkFrame >= 7) {
          this.blinkFrame = -1;
          this.lastBlinkTime = now;
        }
      }
    } else {
      blendshapes['eyeBlinkLeft'] = 0;
      blendshapes['eyeBlinkRight'] = 0;
    }
  }

  public dispose(): void {
    this.liveBlendshapeData = null;
    this._renderer = null;
  }
}
