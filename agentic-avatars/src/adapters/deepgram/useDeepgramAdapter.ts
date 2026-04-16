/**
 * Deepgram Voice Agent adapter for AvatarAgent.
 *
 * Install: npm install @deepgram/sdk
 * Docs:    https://developers.deepgram.com/docs/voice-agent
 *
 * Supports @deepgram/sdk v3 and v5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeepgramClient } from '@deepgram/sdk';
import { getLipsyncManager, resetLipsyncManager } from '../../audio/lipsyncManager';
import type { SessionAdapter } from '../SessionAdapter';
import type { SessionStatus } from '../../types';

export interface UseDeepgramAdapterOptions {
  /**
   * Returns a Deepgram API key.
   * For production, proxy through your backend and never expose the key in the browser.
   */
  getApiKey: () => Promise<string>;

  /** System prompt / instructions for the agent. */
  systemPrompt?: string;

  /**
   * LLM provider config.
   * Defaults to OpenAI gpt-4o-mini.
   */
  llm?: {
    provider?: 'open_ai' | 'anthropic' | 'google' | 'aws_bedrock';
    model?: string;
  };

  /**
   * TTS voice name.
   * Defaults to 'aura-2-thalia-en'.
   * See https://developers.deepgram.com/docs/tts-models for options.
   */
  voice?: string;

  /**
   * STT model for transcription.
   * Defaults to 'nova-3'.
   */
  sttModel?: string;
}

// ── AudioWorklet for mic capture ──────────────────────────────────────────────
const MIC_WORKLET = `
class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(2048);
    this._idx = 0;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this._buf[this._idx++] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767)));
      if (this._idx >= this._buf.length) {
        this.port.postMessage(this._buf.slice().buffer);
        this._idx = 0;
      }
    }
    return true;
  }
}
registerProcessor('deepgram-recording-processor', RecordingProcessor);
`;

// ── PCM16 → Float32 ──────────────────────────────────────────────────────────
function pcm16ToFloat32(raw: ArrayBuffer): Float32Array {
  const view = new DataView(raw);
  const out = new Float32Array(raw.byteLength / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

const OUTPUT_SAMPLE_RATE = 16000;

export function useDeepgramAdapter({
  getApiKey,
  systemPrompt,
  llm = {},
  voice = 'aura-2-thalia-en',
  sttModel = 'nova-3',
}: UseDeepgramAdapterOptions): SessionAdapter {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  const micNodeRef = useRef<AudioWorkletNode | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subscribersRef = useRef(
    new Set<(role: 'assistant' | 'user', text: string) => void>(),
  );

  // ── Lipsync rAF loop ──────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'CONNECTED') return;

    const ctx = playCtxRef.current;
    if (!ctx) return;

    const FFT_SIZE = 2048;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;

    const lipsync = getLipsyncManager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lipsync as any).analyser = analyser;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lipsync as any).audioContext = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lipsync as any).dataArray = new Uint8Array(analyser.frequencyBinCount);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lipsync as any).sampleRate = OUTPUT_SAMPLE_RATE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lipsync as any).binWidth = OUTPUT_SAMPLE_RATE / FFT_SIZE;

    let animFrameId: number;
    const tick = () => {
      lipsync.processAudio();
      animFrameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animFrameId);
      analyser.disconnect();
      analyserRef.current = null;
      resetLipsyncManager();
    };
  }, [status]);

  // ── Agent audio playback ──────────────────────────────────────────────────

  const playPcm16 = useCallback((raw: ArrayBuffer) => {
    const ctx = playCtxRef.current;
    if (!ctx) return;

    const float32 = pcm16ToFloat32(raw);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32 as unknown as Float32Array<ArrayBuffer>, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current ?? ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  // ── Mic capture ───────────────────────────────────────────────────────────

  const startMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 16000 });
    micCtxRef.current = ctx;

    const blob = new Blob([MIC_WORKLET], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source = ctx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(ctx, 'deepgram-recording-processor');
    micNodeRef.current = workletNode;

    workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const socket = socketRef.current;
      if (isMutedRef.current || !socket) return;
      try {
        socket.sendMedia(e.data);
      } catch { /* connection may have closed */ }
    };

    source.connect(workletNode);
  }, []);

  const stopMic = useCallback(() => {
    micNodeRef.current?.port.close();
    micNodeRef.current?.disconnect();
    micNodeRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (micCtxRef.current?.state !== 'closed') micCtxRef.current?.close();
    micCtxRef.current = null;
  }, []);

  // ── Connect / disconnect ──────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (status !== 'DISCONNECTED') return;
    setStatus('CONNECTING');

    try {
      const apiKey = await getApiKey();
      const client = new DeepgramClient({ apiKey });

      playCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      nextPlayTimeRef.current = 0;

      const socket = await client.agent.v1.connect({
        Authorization: `Token ${apiKey}`,
      });
      socketRef.current = socket;

      // ── JSON message handling ─────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('message', (message: any) => {
        if (!message || typeof message !== 'object') return;

        switch (message.type) {
          case 'Welcome':
            socket.sendSettings({
              type: 'Settings',
              audio: {
                input: { encoding: 'linear16', sample_rate: 16000 },
                output: { encoding: 'linear16', sample_rate: OUTPUT_SAMPLE_RATE, container: 'none' },
              },
              agent: {
                listen: {
                  provider: { version: 'v1', type: 'deepgram', model: sttModel },
                },
                think: {
                  provider: {
                    type: llm.provider ?? 'open_ai',
                    model: llm.model ?? 'gpt-4o-mini',
                  },
                  ...(systemPrompt && { prompt: systemPrompt }),
                },
                speak: {
                  provider: { type: 'deepgram', model: voice },
                },
              },
            });
            break;

          case 'SettingsApplied':
            startMic().catch((err) => {
              console.warn('[DeepgramAdapter] mic access failed:', err);
            });
            keepAliveRef.current = setInterval(() => {
              const s = socketRef.current;
              if (s?.readyState === 1 /* OPEN */) {
                s.sendKeepAlive({ type: 'KeepAlive' });
              }
            }, 8000);
            setStatus('CONNECTED');
            break;

          case 'ConversationText':
            if (message.role && message.content) {
              const role = message.role === 'assistant' ? 'assistant' : 'user';
              subscribersRef.current.forEach((h) => h(role, message.content));
            }
            break;

          case 'UserStartedSpeaking':
            if (playCtxRef.current) {
              nextPlayTimeRef.current = playCtxRef.current.currentTime;
            }
            break;

          case 'Error':
            console.error('[DeepgramAdapter] agent error:', message);
            break;
        }
      });

      socket.on('close', () => {
        clearInterval(keepAliveRef.current ?? undefined);
        keepAliveRef.current = null;
        stopMic();
        socketRef.current = null;
        if (playCtxRef.current?.state !== 'closed') {
          try { playCtxRef.current?.close(); } catch { /* ignore */ }
        }
        playCtxRef.current = null;
        setStatus('DISCONNECTED');
      });

      socket.on('error', (err: unknown) => {
        console.error('[DeepgramAdapter] socket error:', err);
      });

      // Start the WebSocket connection and register event handlers.
      // After connect(), hook into the underlying ReconnectingWebSocket to
      // intercept binary audio frames before the SDK tries to parse them
      // as text (avoids Buffer.from() errors in browsers).
      socket.connect();

      const rawWs = socket.socket as unknown as WebSocket;
      if (rawWs?.addEventListener) {
        rawWs.binaryType = 'arraybuffer';
        rawWs.addEventListener(
          'message',
          (event: MessageEvent) => {
            if (event.data instanceof ArrayBuffer) {
              playPcm16(event.data);
              event.stopImmediatePropagation();
            }
          },
          true, // capture phase — runs before SDK listeners
        );
      }

      await socket.waitForOpen();
    } catch (err) {
      console.error('[DeepgramAdapter] connect failed:', err);
      clearInterval(keepAliveRef.current ?? undefined);
      keepAliveRef.current = null;
      stopMic();
      if (playCtxRef.current?.state !== 'closed') playCtxRef.current?.close();
      playCtxRef.current = null;
      socketRef.current = null;
      setStatus('DISCONNECTED');
      throw err;
    }
  }, [status, getApiKey, systemPrompt, llm, voice, sttModel, startMic, stopMic, playPcm16]);

  const disconnect = useCallback(() => {
    clearInterval(keepAliveRef.current ?? undefined);
    keepAliveRef.current = null;
    stopMic();
    const socket = socketRef.current;
    if (socket) {
      socketRef.current = null;
      try { socket.close(); } catch { /* already closed */ }
    }
    if (playCtxRef.current?.state !== 'closed') {
      try { playCtxRef.current?.close(); } catch { /* ignore */ }
    }
    playCtxRef.current = null;
    setStatus('DISCONNECTED');
  }, [stopMic]);

  const mute = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  const remoteStream: MediaStream | null = null;

  const subscribeToTranscript = useCallback(
    (handler: (role: 'assistant' | 'user', text: string) => void): (() => void) => {
      subscribersRef.current.add(handler);
      return () => subscribersRef.current.delete(handler);
    },
    [],
  );

  return useMemo<SessionAdapter>(
    () => ({ status, connect, disconnect, mute, remoteStream, subscribeToTranscript }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, connect, disconnect, mute, subscribeToTranscript],
  );
}
