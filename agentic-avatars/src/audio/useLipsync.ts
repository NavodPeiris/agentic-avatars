import { useEffect } from 'react';
import type { SessionStatus } from '../types';
import { getLipsyncManager, resetLipsyncManager } from './lipsyncManager';

interface UseLipsyncOptions {
  sessionStatus: SessionStatus;
  audioElement: HTMLAudioElement | null;
  onStartRecording?: (stream: MediaStream) => void;
  onStopRecording?: () => void;
}

/**
 * Wires the remote audio stream into the Lipsync analyser whenever the
 * session is CONNECTED, and tears down cleanly on disconnect / unmount.
 */
export function useLipsync({
  sessionStatus,
  audioElement,
  onStartRecording,
  onStopRecording,
}: UseLipsyncOptions) {
  useEffect(() => {
    if (sessionStatus !== 'CONNECTED' || !audioElement?.srcObject) return;

    const remoteStream = audioElement.srcObject as MediaStream;
    if (remoteStream.getAudioTracks().length === 0) return;

    const audioCtx = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    if (audioCtx.state === 'suspended') audioCtx.resume();

    const sourceNode = audioCtx.createMediaStreamSource(remoteStream);
    const analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 2048;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0;
    const destNode = audioCtx.createMediaStreamDestination();

    sourceNode.connect(analyserNode);
    analyserNode.connect(gainNode);
    gainNode.connect(destNode);

    // Patch the analyser into the shared lipsync singleton
    const lipsync = getLipsyncManager();
    (lipsync as any).analyser = analyserNode;
    (lipsync as any).audioContext = audioCtx;
    (lipsync as any).dataArray = dataArray;
    (lipsync as any).sampleRate = audioCtx.sampleRate;
    (lipsync as any).binWidth = audioCtx.sampleRate / 2048;

    let animFrameId: number;
    const tick = () => {
      lipsync.processAudio();
      animFrameId = requestAnimationFrame(tick);
    };
    tick();

    onStartRecording?.(remoteStream);

    return () => {
      cancelAnimationFrame(animFrameId);
      sourceNode.disconnect();
      analyserNode.disconnect();
      gainNode.disconnect();
      if (audioCtx.state !== 'closed') audioCtx.close();
      resetLipsyncManager();
      onStopRecording?.();
    };
  // Re-run whenever the audio element's srcObject changes after connect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);
}
