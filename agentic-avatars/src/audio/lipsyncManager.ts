import { Lipsync } from 'wawa-lipsync';

let instance: Lipsync | null = null;

/** Returns the singleton Lipsync instance, creating it on first call. */
export function getLipsyncManager(): Lipsync {
  if (!instance && typeof window !== 'undefined') {
    instance = new Lipsync({ fftSize: 2048, historySize: 10 });
  }
  return instance!;
}

/** Returns a 0–1 audio level from the agent's analyser node. */
export function getAgentAudioLevel(): number {
  if (!instance) return 0;
  const analyser = (instance as any).analyser as AnalyserNode | undefined;
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return avg / 128;
}

/** Clears accumulated state without destroying the instance. */
export function resetLipsyncManager(): void {
  if (instance) {
    (instance as any).history = [];
    (instance as any).features = null;
  }
}
