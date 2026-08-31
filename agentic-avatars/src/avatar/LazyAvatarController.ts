import type { ChatState } from '../types';
import type { IAvatarController, Disposable } from './GaussianAvatarController';

/** Type for GaussianAvatarController's constructor (ensures type safety on dynamic import). */
type GaussianAvatarControllerConstructor = new (
  container: HTMLDivElement,
  assetsPath: string,
  options?: { backgroundColor?: string; onLoadProgress?: (progress: number) => void },
) => IAvatarController & { start?: () => Promise<void> };

export interface LazyAvatarControllerOptions {
  /** Load immediately in background (default: true). */
  preload?: boolean;
  /** Optional CSS color string passed through to the renderer. */
  backgroundColor?: string;
  /** Called with 0-1 progress while the avatar asset bundle downloads. */
  onLoadProgress?: (progress: number) => void;
  /** Called when the avatar is ready to render. */
  onReady?: () => void;
  /** Called if the avatar fails to load. */
  onError?: (error: Error) => void;
  /** Called when background loading starts. */
  onLoadingStart?: () => void;
}

type AvatarControllerWithStart = IAvatarController & { start?: () => Promise<void> };

/**
 * LazyAvatarController lazy-loads the heavy Gaussian-splat renderer and the
 * onnxruntime-web lipsync engine behind a dynamic import, showing a
 * lightweight placeholder until both are ready.
 */
export class LazyAvatarController implements IAvatarController, Disposable {
  private _container: HTMLDivElement;
  private _assetsPath: string;
  private _options: LazyAvatarControllerOptions;

  private _avatar: AvatarControllerWithStart | null = null;
  private _isLoading = false;
  private _isLoaded = false;
  private _loadPromise: Promise<void> | null = null;

  private _pendingState: ChatState = 'Idle';
  private _pendingBlendshapes: Record<string, number> | null = null;
  private _liveBlendshapesEnabled = false;

  private _placeholderEl: HTMLDivElement | null = null;

  constructor(container: HTMLDivElement, assetsPath: string, options: LazyAvatarControllerOptions = {}) {
    this._container = container;
    this._assetsPath = assetsPath;
    this._options = { preload: true, ...options };

    this._showPlaceholder();

    if (this._options.preload) {
      this.load();
    }
  }

  private _showPlaceholder(): void {
    const placeholder = document.createElement('div');
    placeholder.className = 'agentic-avatars-placeholder';
    placeholder.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    placeholder.innerHTML = `
      <div style="
        width: 48px;
        height: 48px;
        border: 3px solid rgba(148, 163, 184, 0.3);
        border-top-color: currentColor;
        border-radius: 50%;
        animation: agentic-avatars-spin 1s linear infinite;
      "></div>
      <style>
        @keyframes agentic-avatars-spin { to { transform: rotate(360deg); } }
      </style>
    `;
    this._container.appendChild(placeholder);
    this._placeholderEl = placeholder;
  }

  private _removePlaceholder(): void {
    this._placeholderEl?.remove();
    this._placeholderEl = null;
  }

  private _showErrorState(error: Error): void {
    this._removePlaceholder();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'agentic-avatars-error';
    errorDiv.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px;
      opacity: 0.7;
      font-family: system-ui, sans-serif;
      font-size: 13px;
    `;
    errorDiv.textContent = 'Avatar unavailable';
    this._container.appendChild(errorDiv);

    console.warn('[agentic-avatars] Avatar failed to load:', error.message);
  }

  public async load(): Promise<void> {
    if (this._isLoaded || this._isLoading) {
      return this._loadPromise ?? Promise.resolve();
    }

    this._isLoading = true;
    this._options.onLoadingStart?.();

    this._loadPromise = this._doLoad();
    return this._loadPromise;
  }

  private async _doLoad(): Promise<void> {
    try {
      const module = await import('./GaussianAvatarController');
      const GaussianAvatarControllerClass = module.GaussianAvatarController as GaussianAvatarControllerConstructor;

      this._avatar = new GaussianAvatarControllerClass(this._container, this._assetsPath, {
        backgroundColor: this._options.backgroundColor,
        onLoadProgress: this._options.onLoadProgress,
      });

      if (this._avatar.start) {
        await this._avatar.start();
      }

      this._removePlaceholder();

      if (this._pendingState !== 'Idle') {
        this._avatar.setChatState(this._pendingState);
      }
      if (this._liveBlendshapesEnabled) {
        this._avatar.enableLiveBlendshapes();
      }
      if (this._pendingBlendshapes) {
        this._avatar.updateBlendshapes(this._pendingBlendshapes);
      }

      this._isLoaded = true;
      this._isLoading = false;
      this._options.onReady?.();
    } catch (error) {
      this._isLoading = false;
      const err = error instanceof Error ? error : new Error(String(error));
      this._showErrorState(err);
      this._options.onError?.(err);
    }
  }

  public start(): void {
    if (this._avatar?.start) {
      this._avatar.start();
    } else if (!this._avatar) {
      this.load();
    }
  }

  // === IAvatarController ===

  public updateBlendshapes(weights: Record<string, number>): void {
    if (this._avatar) {
      this._avatar.updateBlendshapes(weights);
    } else {
      this._pendingBlendshapes = weights;
    }
  }

  public setChatState(state: ChatState): void {
    this._pendingState = state;
    this._avatar?.setChatState(state);
  }

  public getChatState(): ChatState {
    return this._avatar ? this._avatar.getChatState() : this._pendingState;
  }

  public enableLiveBlendshapes(): void {
    this._liveBlendshapesEnabled = true;
    this._avatar?.enableLiveBlendshapes();
  }

  public disableLiveBlendshapes(): void {
    this._liveBlendshapesEnabled = false;
    this._pendingBlendshapes = null;
    this._avatar?.disableLiveBlendshapes();
  }

  public pause(): void {
    this._avatar?.pause?.();
  }

  public resume(): void {
    this._avatar?.resume?.();
  }

  public dispose(): void {
    this._removePlaceholder();
    this._container.querySelector('.agentic-avatars-error')?.remove();
    this._avatar?.dispose();
    this._avatar = null;
    this._isLoaded = false;
  }

  public get isLoaded(): boolean {
    return this._isLoaded;
  }

  public get isLoading(): boolean {
    return this._isLoading;
  }
}
