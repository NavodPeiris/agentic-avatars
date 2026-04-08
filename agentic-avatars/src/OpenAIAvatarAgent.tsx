import { AvatarAgent } from './AvatarAgent';
import { useOpenAIAdapter } from './adapters/openai/useOpenAIAdapter';
import type { OpenAIAvatarAgentProps } from './types';

/**
 * Convenience wrapper that wires the OpenAI Realtime adapter into AvatarAgent.
 * For full flexibility use AvatarAgent + useOpenAIAdapter directly.
 */
export function OpenAIAvatarAgent({
  systemPrompt,
  tools,
  agentVoice,
  getEphemeralKey,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: OpenAIAvatarAgentProps) {
  const adapter = useOpenAIAdapter({ systemPrompt, tools, agentVoice, getEphemeralKey });

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
