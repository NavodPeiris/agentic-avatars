import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAgentSession } from '../../session/useAgentSession';
import type { SessionAdapter } from '../SessionAdapter';
import type { OpenAIRealtimeTool } from '../../types';

export interface UseOpenAIAdapterOptions {
  systemPrompt: string;
  tools?: OpenAIRealtimeTool[];
  agentVoice?: string;
  model?: string;
  getEphemeralKey: () => Promise<string>;
}

/**
 * OpenAI Realtime adapter.
 * Establishes a WebRTC connection directly to the OpenAI Realtime API —
 * no `@openai/agents` SDK required.
 */
export function useOpenAIAdapter({
  systemPrompt,
  tools = [],
  agentVoice = 'sage',
  model = 'gpt-4o-mini-realtime-preview',
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

  // ── Transcript subscriber registry ────────────────────────────────────

  const subscribersRef = useRef(
    new Set<(role: 'assistant' | 'user', text: string) => void>(),
  );

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

  // ── VAD + initial greeting once connected ─────────────────────────────

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
    await rawConnect({
      getEphemeralKey,
      agent: {
        instructions: systemPrompt,
        voice: agentVoice,
        model,
        tools,
      },
      audioElement,
    });
  }, [rawConnect, getEphemeralKey, systemPrompt, agentVoice, model, tools, audioElement]);

  const disconnect = useCallback(() => {
    const stream = audioElement?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
    }
    rawDisconnect();
  }, [audioElement, rawDisconnect]);

  // ── Lipsync stream ────────────────────────────────────────────────────

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (status !== 'CONNECTED' || !audioElement) return;

    let attempts = 0;
    const poll = setInterval(() => {
      const stream = audioElement.srcObject as MediaStream | null;
      if (stream && stream.getAudioTracks().length > 0) {
        setRemoteStream(stream);
        clearInterval(poll);
      } else if (++attempts > 50) {
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
      return () => { subscribersRef.current.delete(handler); };
    },
    [],
  );

  // ── Return stable SessionAdapter ──────────────────────────────────────

  return useMemo<SessionAdapter>(
    () => ({ status, connect, disconnect, mute, remoteStream, sendEvent, subscribeToTranscript }),
    [status, connect, disconnect, mute, remoteStream, sendEvent, subscribeToTranscript],
  );
}
