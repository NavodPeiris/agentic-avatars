import { ConversationProvider } from '@elevenlabs/react';
import { AvatarAgent } from './AvatarAgent';
import { useElevenLabsAdapter } from './adapters/elevenlabs/useElevenLabsAdapter';
import type { ElevenLabsAvatarAgentProps } from './types';

/**
 * Inner component — must be rendered inside ConversationProvider.
 */
function ElevenLabsAvatarAgentInner({
  agentId,
  getConversationToken,
  clientTools,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: ElevenLabsAvatarAgentProps) {
  const adapter = useElevenLabsAdapter({ agentId, getConversationToken, clientTools });

  return (
    <AvatarAgent
      adapter={adapter}
      backgroundImages={backgroundImages}
      onSessionEnd={onSessionEnd}
      endSessionPhrase={endSessionPhrase}
      sessionTimeout={sessionTimeout}
      avatarComponent={avatarComponent}
      className={className}
    />
  );
}

/**
 * Convenience wrapper that wires the ElevenLabs adapter into AvatarAgent.
 * Provides the required ConversationProvider context automatically.
 * For full flexibility use AvatarAgent + useElevenLabsAdapter directly
 * (wrap with ConversationProvider yourself in that case).
 */
export function ElevenLabsAvatarAgent(props: ElevenLabsAvatarAgentProps) {
  return (
    <ConversationProvider>
      <ElevenLabsAvatarAgentInner {...props} />
    </ConversationProvider>
  );
}
