// Main component
export { AvatarAgent } from './AvatarAgent';

// Types — consumers need these to pass correct props
export type { AvatarAgentProps } from './types';

// Re-export the tool helper so consumers don't need a direct @openai/agents import
export { tool } from '@openai/agents/realtime';
