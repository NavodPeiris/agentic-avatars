import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { AvatarScene } from './scene/AvatarScene';
import { Loader } from './ui/Loader';
import { Toolbar } from './ui/Toolbar';
import { useLipsync } from './audio/useLipsync';
import { useAudio } from './audio/useAudio';
import { getAgentAudioLevel } from './audio/lipsyncManager';
import { isMobile } from './utils/isMobile';
import { cn } from './utils/cn';
import type { SessionAdapter } from './adapters/SessionAdapter';

import { Camila } from './avatars/Camila';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_END_PHRASE = 'this is the end';

export interface AvatarAgentProps {
  /** Platform adapter created by one of the useXxxAdapter hooks. */
  adapter: SessionAdapter;

  /** Array of background image URLs. One is chosen at random each mount. */
  backgroundImages?: string[];

  /** Called when the session ends (timeout, end phrase, or adapter-triggered). */
  onSessionEnd?: () => void;

  /**
   * Phrase the agent says to signal the session should end.
   * Case-insensitive substring match against the transcript.
   * Defaults to `"this is the end"`.
   */
  endSessionPhrase?: string;

  /** Session hard-timeout in milliseconds. Defaults to 10 minutes. */
  sessionTimeout?: number;

  /**
   * Avatar to render.
   * - A library exported Avatar Component
   * - A `React.ComponentType` for fully custom avatars.
   *
   */
  avatarComponent?: ComponentType;

  /** Extra class names applied to the outer container div. */
  className?: string;
}

/**
 * Platform-agnostic avatar component.
 * Accepts any SessionAdapter and handles all rendering, lipsync, and
 * session lifecycle logic that is common across platforms.
 */
export function AvatarAgent({
  adapter,
  backgroundImages = [],
  onSessionEnd,
  endSessionPhrase = DEFAULT_END_PHRASE,
  sessionTimeout = DEFAULT_TIMEOUT_MS,
  avatarComponent,
  className,
}: AvatarAgentProps) {
  const mobile = isMobile();
  const [isMuted, setIsMuted] = useState(false);

  // Destructure stable references so effects don't depend on the adapter object
  const { status, connect, disconnect, mute, remoteStream, subscribeToTranscript } = adapter;

  // Stable refs for callbacks used inside long-lived effects
  const onSessionEndRef = useRef(onSessionEnd);
  onSessionEndRef.current = onSessionEnd;
  const endPhraseRef = useRef(endSessionPhrase);
  endPhraseRef.current = endSessionPhrase;

  // ── Audio / lipsync ───────────────────────────────────────────────────

  const { startRecording, stopRecording, getMicLevel, startMicMonitoring, stopMicMonitoring } = useAudio();

  // Start mic level monitoring as soon as connected so the audio bars
  // reflect the user's voice even before agent audio arrives.
  useEffect(() => {
    if (status === 'CONNECTED') {
      startMicMonitoring();
    } else {
      stopMicMonitoring();
    }
  }, [status, startMicMonitoring, stopMicMonitoring]);

  useLipsync({
    remoteStream,
    onStartRecording: startRecording,
    onStopRecording: stopRecording,
  });

  // ── End phrase detection via transcript ───────────────────────────────

  useEffect(() => {
    return subscribeToTranscript((_role, text) => {
      if (text.toLowerCase().includes(endPhraseRef.current.toLowerCase())) {
        setTimeout(() => {
          disconnect();
          onSessionEndRef.current?.();
        }, 0);
      }
    });
  // subscribeToTranscript and disconnect are stable useCallbacks
  }, [subscribeToTranscript, disconnect]);

  // ── Connection toggle ─────────────────────────────────────────────────

  const onToggleConnection = useCallback(() => {
    if (status === 'CONNECTED' || status === 'CONNECTING') {
      disconnect();
    } else {
      connect().catch(() => {
        // error already logged inside the adapter
      });
    }
  }, [status, connect, disconnect]);

  // ── Mute ─────────────────────────────────────────────────────────────

  const onToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    mute(next);
  }, [isMuted, mute]);

  useEffect(() => {
    if (status === 'CONNECTED') mute(isMuted);
  }, [status, isMuted, mute]);

  // ── Session timeout ───────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'CONNECTED') return;
    const id = setTimeout(() => {
      console.log('[AvatarAgent] session timeout');
      disconnect();
      onSessionEndRef.current?.();
    }, sessionTimeout);
    return () => clearTimeout(id);
  }, [status, sessionTimeout, disconnect]);

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

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
            <AvatarScene backgroundImages={backgroundImages} AvatarComponent={avatarComponent ?? Camila} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
