// ── Base component (use this with any adapter for full flexibility) ───────────
export { AvatarAgent } from './AvatarAgent';
export type { AvatarAgentProps } from './AvatarAgent';

// ── Adapter interface (for building custom adapters) ──────────────────────────
export type { SessionAdapter } from './adapters/SessionAdapter';

// ── Export library provided avatars ───────────────────────────────────────────────
export { Fiona } from './avatars/Fiona';
export { Jane } from './avatars/Jane';
export { Sam } from './avatars/Sam';