import { useCallback, useRef, useState } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';
import { audioFormatForCodec, applyCodecPreferences } from './codecUtils';
import type { SessionStatus } from '../types';

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  agent: RealtimeAgent;
  audioElement?: HTMLAudioElement;
}

export interface UseAgentSessionOptions {
  onConnectionChange?: (status: SessionStatus) => void;
  /** Called for every assistant or user transcript message received. */
  onTranscriptMessage?: (role: 'assistant' | 'user', text: string) => void;
}

export function useAgentSession({
  onConnectionChange,
  onTranscriptMessage,
}: UseAgentSessionOptions = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      onConnectionChange?.(s);
    },
    [onConnectionChange],
  );

  const codecParamRef = useRef<string>(
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus').toLowerCase()
      : 'opus',
  );

  const connect = useCallback(
    async ({ getEphemeralKey, agent, audioElement }: ConnectOptions) => {
      if (sessionRef.current || status !== 'DISCONNECTED') return;

      try {
        updateStatus('CONNECTING');

        const ek = await getEphemeralKey();
        const codecParam = codecParamRef.current;
        const audioFormat = audioFormatForCodec(codecParam);

        const newSession = new RealtimeSession(agent, {
          transport: new OpenAIRealtimeWebRTC({
            audioElement,
            changePeerConnection: async (pc: RTCPeerConnection) => {
              if (pc.signalingState !== 'closed') {
                applyCodecPreferences(pc, codecParam);
              }
              return pc;
            },
          }),
          model: 'gpt-realtime-mini-2025-10-06',
          config: {
            inputAudioFormat: audioFormat,
            outputAudioFormat: audioFormat,
            inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' },
          },
        });

        // Forward transcript messages to the caller
        (newSession as any).on('transport_event', (event: any) => {
          if (
            event.type === 'response.audio_transcript.done' &&
            typeof event.transcript === 'string'
          ) {
            onTranscriptMessage?.('assistant', event.transcript);
          }
          if (
            event.type === 'conversation.item.input_audio_transcription.completed' &&
            typeof event.transcript === 'string'
          ) {
            onTranscriptMessage?.('user', event.transcript);
          }
        });

        await newSession.connect({ apiKey: ek });
        sessionRef.current = newSession;
        updateStatus('CONNECTED');
      } catch (err) {
        console.error('[useAgentSession] connect failed:', err);
        sessionRef.current = null;
        updateStatus('DISCONNECTED');
        throw err;
      }
    },
    // status intentionally kept in deps so stale-closure guard works
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, updateStatus, onTranscriptMessage],
  );

  const disconnect = useCallback(() => {
    try {
      sessionRef.current?.close();
    } catch {
      // ignore
    } finally {
      sessionRef.current = null;
      updateStatus('DISCONNECTED');
    }
  }, [updateStatus]);

  const sendEvent = useCallback((ev: unknown) => {
    sessionRef.current?.transport.sendEvent(ev as any);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  return { status, connect, disconnect, sendEvent, mute } as const;
}
