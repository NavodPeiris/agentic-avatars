import { AvatarAgent } from './AvatarAgent';
import { useLiveKitAdapter } from './adapters/livekit/useLiveKitAdapter';
import type { LiveKitAvatarAgentProps } from './types';

/**
 * Convenience wrapper that wires the LiveKit adapter into AvatarAgent.
 * For full flexibility use AvatarAgent + useLiveKitAdapter directly.
 */
export function LiveKitAvatarAgent({
  serverUrl,
  getToken,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: LiveKitAvatarAgentProps) {
  const adapter = useLiveKitAdapter({ serverUrl, getToken });

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
