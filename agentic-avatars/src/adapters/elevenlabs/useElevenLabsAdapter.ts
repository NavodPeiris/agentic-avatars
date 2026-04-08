/**
 * ElevenLabs Conversational AI adapter for AvatarAgent.
 *
 * Install: npm install @elevenlabs/react
 * Docs:    https://elevenlabs.io/docs/eleven-agents/libraries/react
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { getLipsyncManager, resetLipsyncManager } from '../../audio/lipsyncManager';
import type { SessionAdapter } from '../SessionAdapter';
import type { SessionStatus } from '../../types';

export interface UseElevenLabsAdapterOptions {
  /** Agent ID from the ElevenLabs dashboard. */
  agentId: string;

  /**
   * Required for private/authenticated agents.
   * Must fetch a short-lived conversation token from your server:
   *   GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id={agentId}
   *   Header: xi-api-key: <your-api-key>
   * Never expose your API key in the browser — call this from your backend.
   * If omitted, connects with agentId directly (only works for public agents).
   */
  getConversationToken?: () => Promise<string>;

  /**
   * Optional: override individual client tools exposed to the agent.
   * See ElevenLabs docs for the shape.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientTools?: Record<string, (...args: any[]) => any>;
}

export function useElevenLabsAdapter({
  agentId,
  getConversationToken,
  clientTools,
}: UseElevenLabsAdapterOptions): SessionAdapter {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');

  const subscribersRef = useRef(
    new Set<(role: 'assistant' | 'user', text: string) => void>(),
  );

  // ── ElevenLabs conversation hook ──────────────────────────────────────

  const conversation = useConversation({
    onConnect: () => setStatus('CONNECTED'),
    onDisconnect: () => setStatus('DISCONNECTED'),
    onMessage: ({ message, source }: { message: string; source: string }) => {
      const role = source === 'ai' ? 'assistant' : 'user';
      subscribersRef.current.forEach((h) => h(role, message));
    },
    onError: (error: unknown) => {
      console.error('[ElevenLabsAdapter]', error);
      setStatus('DISCONNECTED');
    },
  });

  // ── Lipsync via mock analyser ─────────────────────────────────────────
  //
  // ElevenLabs doesn't expose a MediaStream, but it exposes
  // getOutputByteFrequencyData() — the same Uint8Array that an AnalyserNode
  // would return. We build a minimal mock analyser that delegates to it,
  // then drive the wawa-lipsync singleton directly with a rAF loop.
  // AvatarAgent's useLipsync is a no-op (remoteStream stays null) but the
  // Avatar component reads from the singleton each frame regardless.

  useEffect(() => {
    if (status !== 'CONNECTED') return;

    const FFT_SIZE = 2048;
    const BIN_COUNT = FFT_SIZE / 2;
    const SAMPLE_RATE = 48000; // ElevenLabs uses pcm_48000

    const dataArray = new Uint8Array(BIN_COUNT);

    // Mock AnalyserNode — only the methods used by wawa-lipsync and
    // getAgentAudioLevel() need to be implemented.
    const mockAnalyser = {
      fftSize: FFT_SIZE,
      frequencyBinCount: BIN_COUNT,
      getByteFrequencyData: (arr: Uint8Array) => {
        const d = conversation.getOutputByteFrequencyData();
        if (d && d.length > 0) {
          arr.set(d.subarray(0, Math.min(d.length, arr.length)));
        }
      },
    } as unknown as AnalyserNode;

    const lipsync = getLipsyncManager();
    (lipsync as any).analyser = mockAnalyser;
    (lipsync as any).audioContext = null;
    (lipsync as any).dataArray = dataArray;
    (lipsync as any).sampleRate = SAMPLE_RATE;
    (lipsync as any).binWidth = SAMPLE_RATE / FFT_SIZE;

    let animFrameId: number;
    const tick = () => {
      lipsync.processAudio();
      animFrameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animFrameId);
      resetLipsyncManager();
    };
  }, [status, conversation]);

  // ── ElevenLabs has its own audio playback — no MediaStream needed ─────

  const remoteStream: MediaStream | null = null;

  // ── SessionAdapter methods ─────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (status !== 'DISCONNECTED') return;
    setStatus('CONNECTING');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionOpts: Record<string, any> = { clientTools };
      if (getConversationToken) {
        // Private agent — fetch a short-lived WebRTC token from your server
        sessionOpts.conversationToken = await getConversationToken();
      } else {
        // Public agent — connect directly with agentId
        sessionOpts.agentId = agentId;
      }
      sessionOpts.connectionType = 'webrtc';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.resolve((conversation.startSession as any)(sessionOpts));
    } catch (err) {
      console.error('[ElevenLabsAdapter] connect failed:', err);
      setStatus('DISCONNECTED');
      throw err;
    }
  }, [status, agentId, getConversationToken, clientTools, conversation]);

  const disconnect = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  const mute = useCallback((muted: boolean) => {
    conversation.setMuted(muted);
  }, [conversation]);

  const subscribeToTranscript = useCallback(
    (handler: (role: 'assistant' | 'user', text: string) => void): (() => void) => {
      subscribersRef.current.add(handler);
      return () => {
        subscribersRef.current.delete(handler);
      };
    },
    [],
  );

  return useMemo<SessionAdapter>(
    () => ({ status, connect, disconnect, mute, remoteStream, subscribeToTranscript }),
    // remoteStream is always null (stable), no need to include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, connect, disconnect, mute, subscribeToTranscript],
  );
}
