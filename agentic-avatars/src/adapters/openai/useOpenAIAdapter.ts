import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeAgent } from '@openai/agents/realtime';
import { useAgentSession } from '../../session/useAgentSession';
import type { SessionAdapter } from '../SessionAdapter';
import type { tool } from '@openai/agents/realtime';

export interface UseOpenAIAdapterOptions {
  systemPrompt: string;
  tools?: ReturnType<typeof tool>[];
  agentVoice?: string;
  getEphemeralKey: () => Promise<string>;
}

/**
 * OpenAI Realtime adapter.
 * Wraps useAgentSession with the audio-element lifecycle, VAD configuration,
 * and the initial silent greeting that kicks off the conversation.
 */
export function useOpenAIAdapter({
  systemPrompt,
  tools = [],
  agentVoice = 'sage',
  getEphemeralKey,
}: UseOpenAIAdapterOptions): SessionAdapter {
  // ── Audio element (lives for the lifetime of this hook) ───────────────

  const audioElement = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    return () => {
      audioElement?.pause();
      audioElement?.remove();
    };
  }, [audioElement]);

  // ── RealtimeAgent (rebuilt only when voice changes) ───────────────────

  const agent = useMemo(
    () =>
      new RealtimeAgent({
        name: 'avatarAgent',
        voice: agentVoice,
        instructions: systemPrompt,
        tools,
      }),
    // Intentionally omitting systemPrompt/tools — injected fresh on each connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentVoice],
  );

  // ── Transcript subscriber registry ────────────────────────────────────

  const subscribersRef = useRef(
    new Set<(role: 'assistant' | 'user', text: string) => void>(),
  );

  // Stable dispatcher — safe to pass as onTranscriptMessage without causing
  // useAgentSession to recreate its connect callback on every render.
  const handleTranscript = useCallback((role: 'assistant' | 'user', text: string) => {
    subscribersRef.current.forEach((h) => h(role, text));
  }, []);

  // ── Session core ──────────────────────────────────────────────────────

  const {
    status,
    connect: rawConnect,
    disconnect: rawDisconnect,
    sendEvent,
    mute,
  } = useAgentSession({ onTranscriptMessage: handleTranscript });

  // ── VAD configuration + silent greeting sent once per connect ─────────

  useEffect(() => {
    if (status !== 'CONNECTED') return;

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
      },
    });

    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
    });
    sendEvent({ type: 'response.create' });
  }, [status, sendEvent]);

  // ── Connection ────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    // Inject the latest systemPrompt each time we connect
    agent.instructions = systemPrompt;
    await rawConnect({ getEphemeralKey, agent, audioElement });
  }, [agent, systemPrompt, getEphemeralKey, audioElement, rawConnect]);

  const disconnect = useCallback(() => {
    const stream = audioElement?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
    }
    rawDisconnect();
  }, [audioElement, rawDisconnect]);

  // ── Lipsync stream — reactive state so useLipsync re-runs when it arrives ──

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // audioElement.srcObject is set by the OpenAI WebRTC transport after CONNECTED.
  // Poll briefly until the track lands, then stop.
  useEffect(() => {
    if (status !== 'CONNECTED' || !audioElement) return;

    let attempts = 0;
    const poll = setInterval(() => {
      const stream = audioElement.srcObject as MediaStream | null;
      if (stream && stream.getAudioTracks().length > 0) {
        setRemoteStream(stream);
        clearInterval(poll);
      } else if (++attempts > 50) {
        // give up after ~2.5 s
        clearInterval(poll);
      }
    }, 50);

    return () => {
      clearInterval(poll);
      setRemoteStream(null);
    };
  }, [status, audioElement]);

  // ── Transcript subscription ───────────────────────────────────────────

  const subscribeToTranscript = useCallback(
    (handler: (role: 'assistant' | 'user', text: string) => void): (() => void) => {
      subscribersRef.current.add(handler);
      return () => {
        subscribersRef.current.delete(handler);
      };
    },
    [],
  );

  // ── Return stable SessionAdapter ──────────────────────────────────────

  return useMemo<SessionAdapter>(
    () => ({ status, connect, disconnect, mute, remoteStream, sendEvent, subscribeToTranscript }),
    [status, connect, disconnect, mute, remoteStream, sendEvent, subscribeToTranscript],
  );
}
