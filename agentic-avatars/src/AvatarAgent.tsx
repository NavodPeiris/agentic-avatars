import { useCallback, useEffect, useRef, useState } from 'react';
import { useAvatarController, AvatarContainer } from './avatar/AvatarContainer';
import { DEFAULT_ASSETS_PATH } from './avatar/defaultAvatar';
import { Toolbar } from './ui/Toolbar';
import { useAvatarLipsync } from './audio/useAvatarLipsync';
import { usePushAudioLipsync } from './audio/usePushAudioLipsync';
import { useVolumeFallbackLipsync } from './audio/useVolumeFallbackLipsync';
import { useAudio } from './audio/useAudio';
import { getAgentAudioLevel } from './audio/wav2arkit/agentLevelMeter';
import { isMobile } from './utils/isMobile';
import { cn } from './utils/cn';
import type { SessionAdapter } from './adapters/SessionAdapter';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_END_PHRASE = 'this is the end';

export interface AvatarAgentProps {
  /** Platform adapter created by one of the useXxxAdapter hooks. */
  adapter: SessionAdapter;

  /**
   * URL or path to a hosted Gaussian-splat avatar asset bundle, compatible
   * with `@myned-ai/gsplat-flame-avatar-renderer`. Defaults to the
   * library's built-in "Nyx" avatar.
   */
  assetsPath?: string;

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
  assetsPath,
  backgroundImages = [],
  onSessionEnd,
  endSessionPhrase = DEFAULT_END_PHRASE,
  sessionTimeout = DEFAULT_TIMEOUT_MS,
  className,
}: AvatarAgentProps) {
  const mobile = isMobile();
  const [isMuted, setIsMuted] = useState(false);

  // Destructure stable references so effects don't depend on the adapter object
  const { status, connect, disconnect, mute, remoteStream, getRemoteAudioLevel, subscribeToRemoteAudio, subscribeToTranscript } =
    adapter;

  // Stable refs for callbacks used inside long-lived effects
  const onSessionEndRef = useRef(onSessionEnd);
  onSessionEndRef.current = onSessionEnd;
  const endPhraseRef = useRef(endSessionPhrase);
  endPhraseRef.current = endSessionPhrase;

  // ── Avatar rendering ─────────────────────────────────────────────────

  const { containerRef, controllerRef } = useAvatarController(assetsPath ?? DEFAULT_ASSETS_PATH);

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

  const onStartRecording = useCallback(
    (stream: MediaStream) => {
      startRecording(stream);
      controllerRef.current?.setChatState('Responding');
    },
    [startRecording, controllerRef],
  );

  const onStopRecording = useCallback(() => {
    stopRecording();
    controllerRef.current?.setChatState('Idle');
  }, [stopRecording, controllerRef]);

  useAvatarLipsync({
    remoteStream,
    controllerRef,
    onStartRecording,
    onStopRecording,
  });

  // Adapters that decode raw PCM themselves (e.g. Deepgram) push samples
  // directly into full wav2arkit neural lipsync, bypassing the MediaStream tap.
  usePushAudioLipsync({
    subscribeToRemoteAudio,
    controllerRef,
  });

  // Adapters with neither a MediaStream nor raw audio access (e.g.
  // ElevenLabs) fall back to coarse, volume-driven mouth movement.
  useVolumeFallbackLipsync({
    getRemoteAudioLevel,
    active: status === 'CONNECTED' && !remoteStream && !subscribeToRemoteAudio,
    controllerRef,
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

  // Agent-level meter: real streams feed the shared AnalyserNode-based meter
  // via useAvatarLipsync; stream-less adapters (ElevenLabs) read their own
  // volume scalar directly.
  const getAgentLevel = useCallback(() => {
    return remoteStream ? getAgentAudioLevel() : (getRemoteAudioLevel?.() ?? 0);
  }, [remoteStream, getRemoteAudioLevel]);

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
          getAgentLevel={getAgentLevel}
        />
        <AvatarContainer containerRef={containerRef} backgroundImages={backgroundImages} />
      </div>
    </div>
  );
}
