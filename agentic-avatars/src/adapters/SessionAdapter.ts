import type { SessionStatus } from '../types';

/**
 * Common interface that every platform adapter must implement.
 * The base AvatarAgent component talks exclusively through this contract —
 * platform-specific details stay inside each adapter hook.
 */
export interface SessionAdapter {
  /** Current connection state. Changes trigger re-renders via the adapter hook. */
  readonly status: SessionStatus;

  /** Establish a voice session with the platform. */
  connect(): Promise<void>;

  /** Tear down the session and clean up resources. */
  disconnect(): void;

  /** Mute or unmute the local microphone. */
  mute(muted: boolean): void;

  /**
   * The remote audio MediaStream (agent voice) for lipsync analysis.
   * Must be `null` until audio is actually flowing — not just CONNECTED.
   * Adapters expose this as reactive state so useLipsync re-runs when it arrives.
   */
  remoteStream: MediaStream | null;

  /**
   * Subscribe to transcript messages from both the user and the assistant.
   * Returns an unsubscribe function — call it in useEffect cleanup.
   */
  subscribeToTranscript(
    handler: (role: 'assistant' | 'user', text: string) => void,
  ): () => void;

  /**
   * Send a platform-specific low-level event over the active session.
   * Optional — only implement if the platform supports raw event forwarding.
   */
  sendEvent?(event: unknown): void;
}
