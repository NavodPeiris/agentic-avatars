import { AvatarAgent } from './AvatarAgent';
import { useDeepgramAdapter } from './adapters/deepgram/useDeepgramAdapter';
import type { DeepgramAvatarAgentProps } from './types';

/**
 * Convenience wrapper that wires the Deepgram Voice Agent adapter into AvatarAgent.
 * For full flexibility use AvatarAgent + useDeepgramAdapter directly.
 */
export function DeepgramAvatarAgent({
  getApiKey,
  systemPrompt,
  llm,
  voice,
  sttModel,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: DeepgramAvatarAgentProps) {
  const adapter = useDeepgramAdapter({ getApiKey, systemPrompt, llm, voice, sttModel });

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
