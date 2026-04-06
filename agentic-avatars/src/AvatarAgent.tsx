import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { RealtimeAgent } from '@openai/agents/realtime';

import { AvatarScene } from './scene/AvatarScene';
import { Loader } from './ui/Loader';
import { Toolbar } from './ui/Toolbar';
import { useAgentSession } from './session/useAgentSession';
import { useLipsync } from './audio/useLipsync';
import { useAudio } from './audio/useAudio';
import { getAgentAudioLevel } from './audio/lipsyncManager';
import { isMobile } from './utils/isMobile';
import { cn } from './utils/cn';
import type { AvatarAgentProps } from './types';

const DEFAULT_MODEL_PATH = 'https://cdn.jsdelivr.net/gh/<username>/<repo>@<version_or_branch>/<path_to_file>.glb';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_END_PHRASE = 'this is the end';

export function AvatarAgent({
  systemPrompt,
  tools = [],
  backgroundImages = [],
  getEphemeralKey,
  onSessionEnd,
  endSessionPhrase = DEFAULT_END_PHRASE,
  sessionTimeout = DEFAULT_TIMEOUT_MS,
  agentVoice = 'sage',
  modelPath = DEFAULT_MODEL_PATH,
  className,
}: AvatarAgentProps) {
  const mobile = isMobile();
  const [isMuted, setIsMuted] = useState(false);
  const handoffTriggeredRef = useRef(false);

  // ── Audio element (created once, lives as long as the component) ─────────

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

  // ── Build the RealtimeAgent from provided systemPrompt + tools ───────────

  const agent = useMemo(
    () =>
      new RealtimeAgent({
        name: 'avatarAgent',
        voice: agentVoice,
        instructions: systemPrompt,
        tools,
      }),
    // Rebuild only when identity-critical props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentVoice],
  );

  // ── Session end detection via transcript ─────────────────────────────────

  const handleTranscriptMessage = useCallback(
    (_role: 'assistant' | 'user', text: string) => {
      if (text.toLowerCase().includes(endSessionPhrase.toLowerCase())) {
        setTimeout(() => {
          disconnectAndNotify();
        }, 0);
      }
    },
    // disconnectAndNotify defined below; safe because it's stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endSessionPhrase],
  );

  // ── Session management ───────────────────────────────────────────────────

  const { status, connect, disconnect, sendEvent, mute } = useAgentSession({
    onTranscriptMessage: handleTranscriptMessage,
  });

  const disconnectAndNotify = useCallback(() => {
    disconnect();
    onSessionEnd?.();
  }, [disconnect, onSessionEnd]);

  // ── Audio / lipsync ───────────────────────────────────────────────────────

  const { startRecording, stopRecording, getMicLevel } = useAudio();

  useLipsync({
    sessionStatus: status,
    audioElement: audioElement ?? null,
    onStartRecording: startRecording,
    onStopRecording: stopRecording,
  });

  // ── Connection handlers ───────────────────────────────────────────────────

  const connectToSession = async () => {
    if (status !== 'DISCONNECTED') return;

    // Inject the latest systemPrompt each time we connect
    agent.instructions = systemPrompt;

    try {
      await connect({
        getEphemeralKey,
        agent,
        audioElement,
      });
    } catch {
      // error already logged inside useAgentSession
    }
  };

  const disconnectFromSession = useCallback(() => {
    const stream = audioElement?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
    }
    disconnect();
  }, [audioElement, disconnect]);

  const onToggleConnection = () => {
    if (status === 'CONNECTED' || status === 'CONNECTING') {
      disconnectFromSession();
    } else {
      connectToSession();
    }
  };

  // ── VAD session config on connect ─────────────────────────────────────────

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
    if (!handoffTriggeredRef.current) {
      // Kick off conversation with a silent greeting
      sendEvent({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
      });
      sendEvent({ type: 'response.create' });
    }
    handoffTriggeredRef.current = false;
  }, [status, sendEvent]);

  // ── Mute sync ─────────────────────────────────────────────────────────────

  const onToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    mute(next);
  };

  useEffect(() => {
    if (status === 'CONNECTED') mute(isMuted);
  }, [status, isMuted, mute]);

  // ── Session timeout ───────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'CONNECTED') return;
    const id = setTimeout(() => {
      console.log('[AvatarAgent] session timeout');
      disconnectAndNotify();
    }, sessionTimeout);
    return () => clearTimeout(id);
  }, [status, sessionTimeout, disconnectAndNotify]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => { disconnectFromSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2',
        mobile
          ? 'h-[600px] sm:h-[800px] lg:h-[1000px]'
          : 'h-[300px] sm:h-[800px] lg:h-[1000px]',
        className,
      )}
    >
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <Toolbar
          sessionStatus={status}
          onToggleConnection={onToggleConnection}
          onToggleMute={onToggleMute}
          isMuted={isMuted}
          getMicLevel={getMicLevel}
          getAgentLevel={getAgentAudioLevel}
        />
        <Canvas
          shadows={mobile ? 'basic' : 'soft'}
          camera={{ fov: 30 }}
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
          gl={{
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: mobile ? 1.2 : 1,
            antialias: !mobile,
            alpha: true,
            powerPreference: 'high-performance',
            precision: 'highp',
            logarithmicDepthBuffer: true,
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={<Loader />}>
            <AvatarScene backgroundImages={backgroundImages} modelPath={modelPath} />
          </Suspense>
        </Canvas>
      </div>

    </div>
  );
}
