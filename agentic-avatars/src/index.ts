// ── Base component (use this with any adapter for full flexibility) ───────────
export { AvatarAgent } from './AvatarAgent';
export type { AvatarAgentProps } from './AvatarAgent';

// ── Platform convenience wrappers ─────────────────────────────────────────────
export { OpenAIAvatarAgent } from './OpenAIAvatarAgent';
export { VapiAvatarAgent } from './VapiAvatarAgent';
export { ElevenLabsAvatarAgent } from './ElevenLabsAvatarAgent';
export { LiveKitAvatarAgent } from './LiveKitAvatarAgent';
export { DeepgramAvatarAgent } from './DeepgramAvatarAgent';

// ── Adapter hooks (for composing custom components) ───────────────────────────
export { useOpenAIAdapter } from './adapters/openai/useOpenAIAdapter';
export { useVapiAdapter } from './adapters/vapi/useVapiAdapter';
export { useElevenLabsAdapter } from './adapters/elevenlabs/useElevenLabsAdapter';
export { useLiveKitAdapter } from './adapters/livekit/useLiveKitAdapter';
export { useDeepgramAdapter } from './adapters/deepgram/useDeepgramAdapter';

// ── Adapter interface (for building custom adapters) ──────────────────────────
export type { SessionAdapter } from './adapters/SessionAdapter';

// ── Prop types ────────────────────────────────────────────────────────────────
export type {
  SessionStatus,
  OpenAIAvatarAgentProps,
  VapiAvatarAgentProps,
  ElevenLabsAvatarAgentProps,
  LiveKitAvatarAgentProps,
  DeepgramAvatarAgentProps,
} from './types';

// ── Adapter-specific option types ─────────────────────────────────────────────
export type { UseOpenAIAdapterOptions } from './adapters/openai/useOpenAIAdapter';
export type { UseVapiAdapterOptions } from './adapters/vapi/useVapiAdapter';
export type { UseElevenLabsAdapterOptions } from './adapters/elevenlabs/useElevenLabsAdapter';
export type { UseLiveKitAdapterOptions } from './adapters/livekit/useLiveKitAdapter';
export type { UseDeepgramAdapterOptions } from './adapters/deepgram/useDeepgramAdapter';

// ── Export library provided avatars ───────────────────────────────────────────────
export { Fiona } from './avatars/Fiona';
export { Jane } from './avatars/Jane';
export { Sam } from './avatars/Sam';