// ── Base component (use this with any adapter for full flexibility) ───────────
export { AvatarAgent } from './AvatarAgent';
export type { AvatarAgentProps } from './AvatarAgent';

// ── Adapter interface (for building custom adapters) ──────────────────────────
export type { SessionAdapter } from './adapters/SessionAdapter';

// ── Shared types ──────────────────────────────────────────────────────────────
export type { OpenAIRealtimeTool, DeepgramTool, ChatState } from './types';

// ── Avatar controller contract (for advanced/custom expression pipelines) ─────
export type { IAvatarController } from './avatar/GaussianAvatarController';

// ── ARKit blendshape constants ─────────────────────────────────────────────────
export { ARKIT_BLENDSHAPE_NAMES, createNeutralWeights } from './constants/arkit';