import { AvatarAgent } from './AvatarAgent';
import { useVapiAdapter } from './adapters/vapi/useVapiAdapter';
import type { VapiAvatarAgentProps } from './types';

/**
 * Convenience wrapper that wires the Vapi adapter into AvatarAgent.
 * For full flexibility use AvatarAgent + useVapiAdapter directly.
 */
export function VapiAvatarAgent({
  publicKey,
  assistantId,
  assistant,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: VapiAvatarAgentProps) {
  const adapter = useVapiAdapter({ publicKey, assistantId, assistant });

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
