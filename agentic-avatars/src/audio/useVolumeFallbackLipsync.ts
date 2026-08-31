import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { IAvatarController } from '../avatar/GaussianAvatarController';
import { createNeutralWeights } from '../constants/arkit';

const SPEAKING_THRESHOLD = 0.04;

interface UseVolumeFallbackLipsyncOptions {
  /** Present only for adapters that can't expose a MediaStream (e.g. ElevenLabs). */
  getRemoteAudioLevel?: () => number;
  /** Whether this fallback path should be running (e.g. connected and no remoteStream). */
  active: boolean;
  controllerRef: RefObject<IAvatarController | null>;
}

/**
 * Coarse, volume-only mouth animation for adapters whose SDK exposes only a
 * scalar output level (no raw audio) — currently just ElevenLabs. Other
 * providers use `useAvatarLipsync` (full wav2arkit neural lipsync) instead;
 * this is a deliberately lower-fidelity fallback, not a replacement.
 */
export function useVolumeFallbackLipsync({ getRemoteAudioLevel, active, controllerRef }: UseVolumeFallbackLipsyncOptions) {
  useEffect(() => {
    if (!getRemoteAudioLevel || !active) return;

    const neutral = createNeutralWeights();
    let frameId: number;

    const tick = () => {
      const level = Math.max(0, Math.min(1, getRemoteAudioLevel()));
      controllerRef.current?.setChatState(level > SPEAKING_THRESHOLD ? 'Responding' : 'Idle');
      controllerRef.current?.updateBlendshapes({ ...neutral, jawOpen: Math.min(0.6, level * 0.9), mouthClose: 0 });
      frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      controllerRef.current?.setChatState('Idle');
    };
  }, [getRemoteAudioLevel, active, controllerRef]);
}
