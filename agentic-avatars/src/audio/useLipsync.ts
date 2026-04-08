import { useEffect } from 'react';
import { getLipsyncManager, resetLipsyncManager } from './lipsyncManager';

interface UseLipsyncOptions {
  /** The remote agent audio stream. When this transitions from null to a stream,
   *  the audio pipeline is set up. Must be reactive state (not a ref). */
  remoteStream: MediaStream | null;
  onStartRecording?: (stream: MediaStream) => void;
  onStopRecording?: () => void;
}

/**
 * Wires the remote audio stream into the Lipsync analyser whenever the
 * stream becomes available, and tears down cleanly when it goes away.
 */
export function useLipsync({
  remoteStream,
  onStartRecording,
  onStopRecording,
}: UseLipsyncOptions) {
  useEffect(() => {
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) return;

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
  }, [remoteStream]); // re-runs when the stream reference changes (null → stream → null)
}
